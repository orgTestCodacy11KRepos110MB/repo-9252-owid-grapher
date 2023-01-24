import React from "react"
import { Chart } from "../db/model/Chart.js"
import { GrapherPage } from "../site/GrapherPage.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    without,
    deserializeJSONFromHTML,
    JsonError,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/utils"
import {
    getRelatedArticles,
    getRelatedCharts,
    isWordpressAPIEnabled,
    isWordpressDBEnabled,
} from "../db/wpdb.js"
import * as fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    MAX_NUM_BAKE_PROCESSES,
    DATA_FILES_CHECKSUMS_DIRECTORY,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import * as glob from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { getPostBySlug } from "../db/model/Post.js"
import {
    GRAPHER_VARIABLES_ROUTE,
    GRAPHER_VARIABLE_DATA_ROUTE,
    GRAPHER_VARIABLE_METADATA_ROUTE,
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherInterface,
} from "@ourworldindata/grapher"
import workerpool from "workerpool"
import ProgressBar from "progress"
import fetch from "node-fetch"
import {
    getVariableData,
    getOwidVariableDataPath,
} from "../db/model/Variable.js"

const grapherConfigToHtmlPage = async (grapher: GrapherInterface) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await getPostBySlug(postSlug) : undefined
    const relatedCharts =
        post && isWordpressDBEnabled
            ? await getRelatedCharts(post.id)
            : undefined
    const relatedArticles =
        grapher.id && isWordpressAPIEnabled
            ? await getRelatedArticles(grapher.id)
            : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

export const grapherSlugToHtmlPage = async (slug: string) => {
    const entity = await Chart.getBySlug(slug)
    if (!entity) throw new JsonError("No such chart", 404)
    return grapherConfigToHtmlPage(entity.config)
}

interface BakeVariableDataArguments {
    bakedSiteDir: string
    checksumsDir: string
    variableId: number
}

async function getDataMetadataFromMysql(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
    const variableData = await getVariableData(variableId)
    return {
        data: variableData.data,
        metadata: variableData.metadata,
    }
}

async function assertFileExistsInS3(dataPath: string): Promise<void> {
    const resp = await fetch(dataPath, { method: "HEAD" })
    if (resp.status !== 200) {
        throw new Error("URL not found on S3: " + dataPath)
    }
}

export const bakeVariableData = async (
    bakeArgs: BakeVariableDataArguments
): Promise<BakeVariableDataArguments> => {
    const { data, metadata } = await getDataMetadataFromMysql(
        bakeArgs.variableId
    )

    // If variable data exists in S3, we don't need to write it to disk
    const dataPath = await getOwidVariableDataPath(bakeArgs.variableId)
    if (dataPath) {
        await assertFileExistsInS3(dataPath)
    } else {
        const path = `${bakeArgs.bakedSiteDir}${getVariableDataRoute(
            bakeArgs.variableId
        )}`
        await fs.writeFile(path, JSON.stringify(data))
    }

    const metadataPath = `${bakeArgs.bakedSiteDir}${getVariableMetadataRoute(
        bakeArgs.variableId
    )}`
    await fs.writeFile(metadataPath, JSON.stringify(metadata))

    return bakeArgs
}

const bakeGrapherPageAndVariablesPngAndSVGIfChanged = async (
    bakedSiteDir: string,
    grapher: GrapherInterface
) => {
    const htmlPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    let isSameVersion = false
    try {
        // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
        const html = await fs.readFile(htmlPath, "utf8")
        const savedVersion = deserializeJSONFromHTML(html)
        isSameVersion = savedVersion?.version === grapher.version
    } catch (err) {
        if ((err as any).code !== "ENOENT") console.error(err)
    }

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(outPath, await grapherConfigToHtmlPage(grapher))
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    try {
        await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
        const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
        const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
        if (
            !isSameVersion ||
            !fs.existsSync(svgPath) ||
            !fs.existsSync(pngPath)
        ) {
            const loadDataMetadataPromises: Promise<OwidVariableDataMetadataDimensions>[] =
                variableIds.map(async (variableId) => {
                    const metadataPath = `${bakedSiteDir}${getVariableMetadataRoute(
                        variableId
                    )}`
                    const metadataString = await fs.readFile(
                        metadataPath,
                        "utf8"
                    )
                    const metadataJson = JSON.parse(
                        metadataString
                    ) as OwidVariableWithSourceAndDimension
                    // Use path to S3 if available
                    const dataPath =
                        (await getOwidVariableDataPath(variableId)) ||
                        `${bakedSiteDir}${getVariableDataRoute(variableId)}`
                    const dataString = await fs.readFile(dataPath, "utf8")
                    const dataJson = JSON.parse(
                        dataString
                    ) as OwidVariableMixedData
                    return {
                        data: dataJson,
                        metadata: metadataJson,
                    }
                })
            const variableDataMetadata = await Promise.all(
                loadDataMetadataPromises
            )
            const variableDataMedadataMap = new Map(
                variableDataMetadata.map((item) => [item.metadata.id, item])
            )
            await bakeGraphersToPngs(
                `${bakedSiteDir}/grapher/exports`,
                grapher,
                variableDataMedadataMap,
                OPTIMIZE_SVG_EXPORTS
            )
            console.log(svgPath)
            console.log(pngPath)
        }
    } catch (err) {
        console.error(err)
    }
}

const deleteOldGraphers = async (bakedSiteDir: string, newSlugs: string[]) => {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        console.log(`DELETING ${slug}`)
        try {
            const paths = [
                `${bakedSiteDir}/grapher/${slug}.html`,
                `${bakedSiteDir}/grapher/exports/${slug}.png`,
            ] //, `${BAKED_SITE_DIR}/grapher/exports/${slug}.svg`]
            await Promise.all(paths.map((p) => fs.unlink(p)))
            paths.map((p) => console.log(p))
        } catch (err) {
            console.error(err)
        }
    }
}

export const bakeAllPublishedChartsVariableDataAndMetadata = async (
    bakedSiteDir: string,
    variableIds: number[],
    checksumsDir: string
) => {
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLES_ROUTE}`)
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLE_DATA_ROUTE}`)
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLE_METADATA_ROUTE}`)
    await fs.mkdirp(checksumsDir)

    const progressBar = new ProgressBar(
        "bake variable data/metadata json [:bar] :current/:total :elapseds :rate/s :etas :name\n",
        {
            width: 20,
            total: variableIds.length + 1,
        }
    )

    const jobs: BakeVariableDataArguments[] = variableIds.map((variableId) => ({
        bakedSiteDir,
        variableId,
        checksumsDir,
    }))

    if (MAX_NUM_BAKE_PROCESSES == 1) {
        await Promise.all(
            jobs.map(async (job) => {
                await bakeVariableData(job)
                progressBar.tick({ name: `variableid ${job.variableId}` })
            })
        )
    } else {
        const poolOptions = {
            minWorkers: 2,
            maxWorkers: MAX_NUM_BAKE_PROCESSES,
            // using `process` instead of worker threads is necessary for DuckDB to work
            workerType: "process",
        } as workerpool.WorkerPoolOptions
        const pool = workerpool.pool(__dirname + "/worker.js", poolOptions)
        const jobs: BakeVariableDataArguments[] = variableIds.map(
            (variableId) => ({
                bakedSiteDir,
                variableId,
                checksumsDir,
            })
        )
        try {
            await Promise.all(
                jobs.map((job) =>
                    pool.exec("bakeVariableData", [job]).then((job) =>
                        progressBar.tick({
                            name: `variableid ${job.variableId}`,
                        })
                    )
                )
            )
        } finally {
            await pool.terminate(true)
        }
    }
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log(`⏩ ${grapher.slug} redirects to explorer`)
        return
    }

    await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
        args.bakedSiteDir,
        grapher
    )
    return args
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string) => {
        const variablesToBake: { varId: number }[] =
            await db.queryMysql(`select distinct vars.varID as varId
            from
            charts c,
            json_table(c.config, '$.dimensions[*]' columns (varID integer path '$.variableId') ) as vars
            where JSON_EXTRACT(c.config, '$.isPublished')=true`)

        await bakeAllPublishedChartsVariableDataAndMetadata(
            bakedSiteDir,
            variablesToBake.map((v) => v.varId),
            DATA_FILES_CHECKSUMS_DIRECTORY
        )

        const rows: { id: number; config: string; slug: string }[] =
            await db.queryMysql(`
                SELECT
                    id, config, config->>'$.slug' as slug
                FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true
                ORDER BY JSON_EXTRACT(config, "$.slug") ASC
                `)

        const newSlugs = rows.map((row) => row.slug)
        await fs.mkdirp(bakedSiteDir + "/grapher")
        const jobs: BakeSingleGrapherChartArguments[] = rows.map((row) => ({
            id: row.id,
            config: row.config,
            bakedSiteDir: bakedSiteDir,
            slug: row.slug,
        }))

        const progressBar = new ProgressBar(
            "bake grapher page [:bar] :current/:total :elapseds :rate/s :etas :name\n",
            {
                width: 20,
                total: rows.length + 1,
            }
        )

        if (MAX_NUM_BAKE_PROCESSES == 1) {
            await Promise.all(
                jobs.map(async (job) => {
                    await bakeSingleGrapherChart(job)
                    progressBar.tick({ name: `slug ${job.slug}` })
                })
            )
        } else {
            const poolOptions = {
                minWorkers: 2,
                maxWorkers: MAX_NUM_BAKE_PROCESSES,
            }
            const pool = workerpool.pool(__dirname + "/worker.js", poolOptions)
            try {
                await Promise.all(
                    jobs.map((job) =>
                        pool.exec("bakeSingleGrapherChart", [job]).then(() =>
                            progressBar.tick({
                                name: `Baked chart ${job.slug}`,
                            })
                        )
                    )
                )
            } finally {
                await pool.terminate(true)
            }
        }

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
