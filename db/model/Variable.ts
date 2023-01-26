import * as lodash from "lodash"
import _, { reverse } from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableDimensionValueFull,
    OwidVariableDimensionValuePartial,
    OwidVariableMixedData,
    OwidVariableWithSourceAndType,
    omitNullableValues,
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableId,
    OwidSource,
} from "@ourworldindata/utils"
import fetch from "node-fetch"
import pl from "nodejs-polars"

export interface VariableRow {
    id: number
    name: string
    shortName?: string
    code: string | null
    unit: string
    shortUnit: string | null
    description: string | null
    createdAt: Date
    updatedAt: Date
    datasetId: number
    sourceId: number
    display: OwidVariableDisplayConfigInterface
    coverage?: string
    timespan?: string
    columnOrder?: number
    catalogPath?: string
    dataPath?: string
    dimensions?: Dimensions
}

interface EntityRow {
    entityId: number
    entityName: string
    entityCode: string
}

interface Dimensions {
    originalName: string
    originalShortName: string
    filters: {
        name: string
        value: string
    }[]
}

export type VariableQueryRow = Readonly<
    UnparsedVariableRow & {
        display: string
        datasetName: string
        nonRedistributable: number
        sourceName: string
        sourceDescription: string
        dimensions: string
    }
>

interface S3DataRow {
    value: string
    year: number
    entityId: number
}

type DataRow = S3DataRow & { entityName: string; entityCode: string }

export type UnparsedVariableRow = VariableRow & { display: string }

export type Field = keyof VariableRow

export const variableTable = "variables"

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    for (const row of plainRows) {
        row.display = row.display ? JSON.parse(row.display) : undefined
    }
    return plainRows
}

// TODO: we'll want to split this into getVariableData and getVariableMetadata once
// the data API can provide us with the type and distinct dimension values for a
// variable. Before that we need to fetch and iterate the data before we can return
// the metadata so it doesn't make much sense to split this into two functions yet.
export async function getVariableData(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
    type VariableQueryRow = Readonly<
        UnparsedVariableRow & {
            display: string
            datasetName: string
            nonRedistributable: number
            sourceName: string
            sourceDescription: string
            dimensions: string
        }
    >

    const variableQuery: Promise<VariableQueryRow | undefined> = db.mysqlFirst(
        `
        SELECT
            variables.*,
            datasets.name AS datasetName,
            datasets.nonRedistributable AS nonRedistributable,
            sources.name AS sourceName,
            sources.description AS sourceDescription
        FROM variables
        JOIN datasets ON variables.datasetId = datasets.id
        JOIN sources ON variables.sourceId = sources.id
        WHERE variables.id = ?
        `,
        [variableId]
    )

    const row = await variableQuery
    if (row === undefined) throw new Error(`Variable ${variableId} not found`)

    const results: DataRow[] = await joinEntityInfo(
        await readValuesFromS3(variableId)
    )

    const {
        sourceId,
        sourceName,
        sourceDescription,
        nonRedistributable,
        display: displayJson,
        ...variable
    } = row
    const display = JSON.parse(displayJson)
    const partialSource: OwidSource = JSON.parse(sourceDescription)
    const variableMetadata: OwidVariableWithSourceAndType = {
        ...omitNullableValues(variable),
        type: "mixed", // precise type will be updated further down
        nonRedistributable: Boolean(nonRedistributable),
        display,
        source: {
            id: sourceId,
            name: sourceName,
            dataPublishedBy: partialSource.dataPublishedBy || "",
            dataPublisherSource: partialSource.dataPublisherSource || "",
            link: partialSource.link || "",
            retrievedDate: partialSource.retrievedDate || "",
            additionalInfo: partialSource.additionalInfo || "",
        },
    }
    const variableData: OwidVariableMixedData = {
        years: [],
        entities: [],
        values: [],
    }

    const entityMap = new Map<number, OwidVariableDimensionValueFull>()
    const yearMap = new Map<number, OwidVariableDimensionValuePartial>()

    let encounteredFloatDataValues = false
    let encounteredIntDataValues = false
    let encounteredStringDataValues = false

    for (const row of results) {
        variableData.years.push(row.year)
        variableData.entities.push(row.entityId)
        const asNumber = parseFloat(row.value)
        const asInt = parseInt(row.value)
        if (!isNaN(asNumber)) {
            if (!isNaN(asInt)) encounteredIntDataValues = true
            else encounteredFloatDataValues = true
            variableData.values.push(asNumber)
        } else {
            encounteredStringDataValues = true
            variableData.values.push(row.value)
        }

        if (!entityMap.has(row.entityId)) {
            entityMap.set(row.entityId, {
                id: row.entityId,
                name: row.entityName,
                code: row.entityCode,
            })
        }

        if (!yearMap.has(row.year)) {
            yearMap.set(row.year, { id: row.year })
        }
    }

    if (encounteredFloatDataValues && encounteredStringDataValues) {
        variableMetadata.type = "mixed"
    } else if (encounteredFloatDataValues) {
        variableMetadata.type = "float"
    } else if (encounteredIntDataValues) {
        variableMetadata.type = "int"
    } else if (encounteredStringDataValues) {
        variableMetadata.type = "string"
    }

    return {
        data: variableData,
        metadata: {
            ...variableMetadata,
            dimensions: {
                years: { values: Array.from(yearMap.values()) },
                entities: { values: Array.from(entityMap.values()) },
            },
        },
    }
}

export async function getDataForMultipleVariables(
    variableIds: number[]
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const promises = variableIds.map(
        async (id) => await getVariableData(id as number)
    )
    const allVariablesDataAndMetadata = await Promise.all(promises)
    const allVariablesDataAndMetadataMap = new Map(
        allVariablesDataAndMetadata.map((item) => [item.metadata.id, item])
    )
    return allVariablesDataAndMetadataMap
}

export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await readSQLasDF(
            `
        SELECT
            id as variableId,
            name as variableName,
            columnOrder
        FROM variables v
        WHERE id IN (?)`,
            [variableIds]
        )
    ).withColumn(pl.col("variableId").cast(pl.Int32))

    // Throw an error if not all variables exist
    if (variablesDF.shape.height !== variableIds.length) {
        const fetchedVariableIds = variablesDF.getColumn("variableId").toArray()
        const missingVariables = _.difference(variableIds, fetchedVariableIds)
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    // get data values as dataframe
    const dataValuesDF = await dataAsDF(
        variablesDF.getColumn("variableId").toArray()
    )

    dataValuesDF
        .join(variablesDF, { on: "variableId" })
        .sort(["columnOrder", "variableId"])
        // variables as columns
        .pivot("value", {
            index: ["entityName", "year"],
            columns: "variableName",
        })
        .sort(["entityName", "year"])
        .rename({ entityName: "Entity", year: "Year" })
        .writeCSV(stream)
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    // TODO: test this!
    if (!variableId || !entityId) return

    let df = (await dataAsDF([variableId])).filter(
        pl.col("entityId").eq(entityId)
    )

    if (year) {
        df = df.filter(pl.col("year").eq(year))
    } else {
        df = df.sort(["year"], true).limit(1)
    }

    if (df.shape.height == 0) return

    const row = df.toRecords()[0]

    return {
        value: Number(row.value),
        year: Number(row.year),
        unit: row.unit,
        entityName: row.entityName,
    }
}

export const getOwidChartDimensionConfigForVariable = async (
    variableId: OwidVariableId,
    chartId: number
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.mysqlFirst(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM charts
        WHERE id = ?
        `,
        [chartId]
    )
    if (!row.dimensions) return
    const dimensions = JSON.parse(row.dimensions)
    return dimensions.find(
        (dimension: OwidChartDimensionInterface) =>
            dimension.variableId === variableId
    )
}

export const getOwidVariableDisplayConfig = async (
    variableId: OwidVariableId
): Promise<OwidVariableDisplayConfigInterface | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT display FROM variables WHERE id = ?`,
        [variableId]
    )
    if (!row.display) return
    return JSON.parse(row.display)
}

export const getOwidVariableDataPath = async (
    variableId: OwidVariableId
): Promise<string | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT dataPath FROM variables WHERE id = ?`,
        [variableId]
    )
    return row.dataPath
}

export const fetchEntitiesByIds = async (
    entityIds: number[]
): Promise<EntityRow[]> => {
    return db.queryMysql(
        `
            SELECT
                id AS entityId,
                name AS entityName,
                code AS entityCode
            FROM entities WHERE id in (?)
            `,
        [_(entityIds).uniq().value()]
    )
}

interface S3Response {
    entities: number[]
    years: number[]
    values: string[]
}

const fetchS3Values = async (
    variableId: OwidVariableId
): Promise<S3Response> => {
    const dataPath = await getOwidVariableDataPath(variableId)
    if (!dataPath) {
        throw new Error(`Missing dataPath for variable ${variableId}`)
    }
    return (await (await fetch(dataPath)).json()) as S3Response
}

export const readValuesFromS3 = async (
    variableId: OwidVariableId
): Promise<S3DataRow[]> => {
    const result = await fetchS3Values(variableId)

    const rows = _.zip(result.entities, result.years, result.values).map(
        (row: any) => {
            return {
                entityId: row[0],
                year: row[1],
                value: row[2],
            }
        }
    )

    return rows
}

export const joinEntityInfo = async <T extends { entityId: number }>(
    rows: T[]
): Promise<(T & { entityName: string; entityCode: string })[]> => {
    // fetch entities info
    const entities = await fetchEntitiesByIds(rows.map((row) => row.entityId))

    return rows.map((row) => {
        const entity = entities.find((e) => e.entityId === row.entityId)
        if (!entity) {
            throw new Error(`Missing entity ${row.entityId}`)
        }
        return {
            ...row,
            entityName: entity.entityName,
            entityCode: entity.entityCode,
        } as T & { entityName: string; entityCode: string }
    })
}

export const joinDataValues = async <T extends { variableId: number }>(
    variableRows: T[]
): Promise<(T & S3DataRow)[]> => {
    // get all variable ids from rows
    const variableIds = variableRows.map((row) => row.variableId)
    if (_.uniq(variableIds).length !== variableIds.length) {
        throw new Error("Duplicate variable ids")
    }

    // load all corresponding S3 json data files and expand them
    return _.flatten(
        await Promise.all(
            variableRows.map(async (variableRow) => {
                const rows = await readValuesFromS3(variableRow.variableId)
                return rows.map((row) => ({
                    ...row,
                    ...variableRow,
                }))
            })
        )
    )
}

export const dataAsDF = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    const dfs = await Promise.all(
        variableIds.map(async (variableId) => {
            return pl
                .DataFrame(await readValuesFromS3(variableId))
                .select(
                    pl.col("entityId").cast(pl.Int32),
                    pl.col("year").cast(pl.Int32),
                    pl.col("value").cast(pl.Utf8),
                    pl.lit(variableId).cast(pl.Int32).alias("variableId")
                )
        })
    )

    const df = pl.concat(dfs)

    // move this to its own method
    const entityDF = (
        await readSQLasDF(
            `
        SELECT
            id AS entityId,
            name AS entityName,
            code AS entityCode
        FROM entities WHERE id in (?)
        `,
            // Series.unique() is raising an error
            [_.uniq(df.getColumn("entityId").toArray())]
        )
    ).select(
        pl.col("entityId").cast(pl.Int32),
        pl.col("entityName").cast(pl.Utf8),
        pl.col("entityCode").cast(pl.Utf8)
    )

    return df.join(entityDF, { on: "entityId" })
}

export const readSQLasDF = async (
    sql: string,
    params: any[]
): Promise<pl.DataFrame> => {
    const rows = await db.queryMysql(sql, params)
    // convert to plain objects to avoid an error
    return pl.DataFrame(rows.map((r: any) => ({ ...r })))
}
