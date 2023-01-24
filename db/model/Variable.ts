import * as lodash from "lodash"
import _ from "lodash"
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
    arrToCsvRow,
    omitNullableValues,
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableId,
    OwidSource,
} from "@ourworldindata/utils"
import fetch from "node-fetch"

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

interface DataRow {
    value: string
    year: number
    entityId: number
    entityName: string
    entityCode: string
}

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

    let results: DataRow[] = []
    if (await getOwidVariableDataPath(variableId)) {
        results = await readValuesFromS3(variableId)
    } else {
        results = await readValuesFromMysql(variableId)
    }

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

// TODO use this in Dataset.writeCSV() maybe?
export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    const variableQuery: Promise<{ id: number; name: string }[]> =
        db.queryMysql(
            `
            SELECT id, name
            FROM variables
            WHERE id IN (?)
            `,
            [variableIds]
        )

    const dataQuery: Promise<
        {
            variableId: number
            entity: string
            year: number
            value: string
        }[]
    > = db.queryMysql(
        `
        SELECT
            data_values.variableId AS variableId,
            entities.name AS entity,
            data_values.year AS year,
            data_values.value AS value
        FROM
            data_values
            JOIN entities ON entities.id = data_values.entityId
            JOIN variables ON variables.id = data_values.variableId
        WHERE
            data_values.variableId IN (?)
        ORDER BY
            data_values.entityId ASC,
            data_values.year ASC
        `,
        [variableIds]
    )

    let variables = await variableQuery
    const variablesById = lodash.keyBy(variables, "id")

    // Throw an error if not all variables exist
    if (variables.length !== variableIds.length) {
        const fetchedVariableIds = variables.map((v) => v.id)
        const missingVariables = lodash.difference(
            variableIds,
            fetchedVariableIds
        )
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    variables = variableIds.map((variableId) => variablesById[variableId])

    const columns = ["Entity", "Year"].concat(variables.map((v) => v.name))
    stream.write(arrToCsvRow(columns))

    const variableColumnIndex: { [id: number]: number } = {}
    for (const variable of variables) {
        variableColumnIndex[variable.id] = columns.indexOf(variable.name)
    }

    const data = await dataQuery

    let row: unknown[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length) {
                stream.write(arrToCsvRow(row))
            }
            row = [datum.entity, datum.year]
            for (const _ of variables) {
                row.push("")
            }
        }
        row[variableColumnIndex[datum.variableId]] = datum.value
    }
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    const queryStart = `
        SELECT
            value,
            year,
            variables.unit AS unit,
            entities.name AS entityName
        FROM data_values
        JOIN entities on entities.id = data_values.entityId
        JOIN variables on variables.id = data_values.variableId
        WHERE entities.id = ?
        AND variables.id = ?`

    const queryStartVariables = [entityId, variableId]

    let row

    if (year) {
        row = await db.mysqlFirst(
            `${queryStart}
            AND data_values.year = ?`,
            [...queryStartVariables, year]
        )
    } else {
        row = await db.mysqlFirst(
            `${queryStart}
            ORDER BY data_values.year DESC
            LIMIT 1`,
            queryStartVariables
        )
    }

    if (!row) return

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

const readValuesFromMysql = async (
    variableId: OwidVariableId
): Promise<DataRow[]> => {
    return db.queryMysql(
        `
        SELECT
            value,
            year,
            entities.id AS entityId,
            entities.name AS entityName,
            entities.code AS entityCode
        FROM data_values
        LEFT JOIN entities ON data_values.entityId = entities.id
        WHERE data_values.variableId = ?
        ORDER BY
            year ASC
        `,
        [variableId]
    )
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

export const readValuesFromS3 = async (
    variableId: OwidVariableId
): Promise<DataRow[]> => {
    const dataPath = await getOwidVariableDataPath(variableId)
    if (!dataPath) {
        throw new Error(`Missing dataPath for variable ${variableId}`)
    }
    const result = (await (await fetch(dataPath)).json()) as S3Response

    // fetch entities info
    const entities = await fetchEntitiesByIds(result.entities)

    return _.zip(result.entities, result.years, result.values).map(
        (row: any) => {
            const entity = entities.find((e) => e.entityId === row[0])
            if (!entity) {
                throw new Error(
                    `Missing entity ${row[0]} for variable ${variableId}`
                )
            }
            return {
                entityId: entity.entityId,
                entityName: entity.entityName,
                entityCode: entity.entityCode,
                year: row[1],
                value: row[2],
            } as DataRow
        }
    )
}
