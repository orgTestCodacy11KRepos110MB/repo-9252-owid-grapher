<?php

namespace OWID;

use DateTimeImmutable;
use Exception;
use Lcobucci\Clock\FrozenClock;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Validation\Constraint\PermittedFor;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Constraint\StrictValidAt;
use Lcobucci\JWT\Validation\RequiredConstraintsViolated;

const CLOUDFLARE_COOKIE_NAME = "CF_Authorization";
/*
 * Attempts to find a valid user within the JWT, after verifying and validating
 * it. If successful, the user is automatically signed in, through SSO.
 *
 * Errors happening during the authorization flow are silently logged. The
 * standard login form is then displayed as a fallback.
 */
function auth_cloudflare_sso($user, $username, $password)
{
    $jwt_cookie = $_COOKIE[CLOUDFLARE_COOKIE_NAME] ?? null;
    // If the cookie is present, it means that route is being protected by
    // Cloudflare Access.
    if (!$jwt_cookie) {
        // No errors logged here as this can be a legitimate situation, e.g.
        // when working locally.
        return;
    }

    $audTag = getenv('CLOUDFLARE_AUD');
    if (empty($audTag)) {
        error_log(
            "Missing or empty audience tag. Please add CLOUDFLARE_AUD key in .env."
        );
        return;
    }

    $certsUrl = "https://owid.cloudflareaccess.com/cdn-cgi/access/certs";
    $response = file_get_contents($certsUrl);
    $certs = json_decode($response);
    $publicCerts = $certs->public_certs;
    if (empty($publicCerts)) {
        error_log("Missing public certificates from Cloudflare.");
        return;
    }

    $valid = false;
    foreach ($publicCerts as $publicCert) {
        // Configure for token verification only (as opposed to creation and verification)
        // see https://github.com/lcobucci/jwt/discussions/720#discussioncomment-606683
        $config = Configuration::forAsymmetricSigner(
            new Sha256(),
            InMemory::empty(),
            InMemory::plainText($publicCert->cert)
        );

        try {
            $token = $config->parser()->parse($jwt_cookie);
        } catch (Exception $e) {
            error_log(
                "Malformed JWT token in " .
                    CLOUDFLARE_COOKIE_NAME .
                    " cookie, cannot be parsed"
            );
            return;
        }

        try {
            $config->setValidationConstraints(
                new PermittedFor($audTag),
                new SignedWith($config->signer(), $config->verificationKey()),
                new StrictValidAt(new FrozenClock(new DateTimeImmutable()))
            );
            $config
                ->validator()
                ->assert($token, ...$config->validationConstraints());
            $valid = true;
            break;
        } catch (RequiredConstraintsViolated $e) {
            // Do not send the whole $e to error_log (will trigger a 502 on Nginx without proper configuration)
            // "upstream sent too big header while reading response header from upstream"
            // todo: revisit current workaround to resurface the full stack trace output
            error_log($e->getMessage() . "\n");
        }
    }

    if (!$valid) {
        error_log(
            "Token validation failed: signature mismatch, token expired or wrong audience"
        );
        return;
    }

    $user = get_user_by('email', $token->claims()->get('email'));
    if (!$user) {
        // This error will be shown to the user. We won't show the fallback
        // login form here as attempting to log in with the same user will
        // trigger a similar error (since the user does not exist).
        wp_die('User not found. Please contact an administrator.');
    }

    return $user;
}

add_action('login_init', function () {
    add_filter('authenticate', __NAMESPACE__ . '\auth_cloudflare_sso', 10, 3);
    $user = wp_signon();
    if ($user instanceof \WP_User) {
        wp_set_current_user($user->data->ID, $user->data->user_login);
        // HACK: reauth is set to 1 when the auth cookies are invalid or expired
        // (e.g. refreshing the admin panel with expired or missing cookies),
        // thus leading to clearing them in wp-login.php. In our case, it is
        // possible that reauth=1, and yet auth cookies are valid as we just set
        // them (again) through an automatic log in.
        // This prevents clearing the auth cookies we just set, which
        // would lead to an infinite redirection loop.
        $_REQUEST['reauth'] = 0;
        wp_redirect($_REQUEST["redirect_to"] ?? admin_url());
    }
});

add_action('wp_logout', function () {
    // This is just some standard browser cleanup. It does not log out of
    // Cloudflare. When WP attempts to log out, auth_cloudflare_sso() will try
    // to log back in. If the JWT stored in the cookie is still valid, then the
    // user will be redirected to the admin (even though the logout button was
    // clicked). This is why a short token validity is required.
    unset($_COOKIE[CLOUDFLARE_COOKIE_NAME]);
    setcookie(CLOUDFLARE_COOKIE_NAME, "", time() - 3600, '/');
});

/*
 * Since the logout URL is identical to the login URL (plus an ?action=logout
 * query parameter), it is protected by Cloudflare. Logging out then prompts the
 * user to log in, which we don't want. This filter changes the logout URL to
 * point it to a custom page, where the logout is performed.
 */
add_filter(
    'logout_url',
    function () {
        $logout_url = wp_nonce_url(
            plugins_url('logout.php', __FILE__),
            'log-out'
        );
        return $logout_url;
    },
    10,
    0
);

/* Prevent unauthenticated requests to the REST API
 *
 * https://developer.wordpress.org/rest-api/frequently-asked-questions/#require-authentication-for-all-requests
 */
add_filter('rest_authentication_errors', function ($result) {
    // If a previous authentication check was applied,
    // pass that result along without modification.
    if (true === $result || is_wp_error($result)) {
        return $result;
    }

    // No authentication has been performed yet.
    // Return an error if user is not logged in.
    if (!is_user_logged_in()) {
        return new \WP_Error(
            'rest_not_logged_in',
            __('You are not currently logged in.'),
            ['status' => 401]
        );
    }

    // Our custom authentication check should have no effect
    // on logged-in requests
    return $result;
});

/* Prevent unauthenticated requests to the GraphQL API
 *
 * https://www.wpgraphql.com/2019/01/30/preventing-unauthenticated-requests-to-your-wpgraphql-api/
 */

add_action(
    'do_graphql_request',
    function ($query) {
        if (!defined('GRAPHQL_HTTP_REQUEST') || true !== GRAPHQL_HTTP_REQUEST) {
            return;
        }

        $introspection_query = \GraphQL\Type\Introspection::getIntrospectionQuery();
        $is_introspection_query = trim($query) === trim($introspection_query);

        if ($is_introspection_query) {
            return;
        }

        if (!get_current_user_id()) {
            throw new \GraphQL\Error\UserError(
                __('You do not have permission to access the API')
            );
        }
    },
    10,
    1
);
