import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

export const SearchPage = (props: { baseUrl: string }) => {
    const { baseUrl } = props
    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/search`}
                pageTitle="Search"
                pageDesc="Search articles and charts on Our World in Data."
                baseUrl={baseUrl}
            />
            <body className="SearchPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <form action="/search" method="GET">
                        <div className="inputWrapper">
                            <input
                                type="search"
                                name="q"
                                placeholder={`Try "Poverty", "Population growth" or "Plastic pollution"`}
                                autoFocus
                            />
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <button type="submit">Search</button>
                    </form>
                    <div className="searchResults"></div>
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                <script type="module">{`window.runSearchPage()`}</script>
            </body>
        </html>
    )
}
