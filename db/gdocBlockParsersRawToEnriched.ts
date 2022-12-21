import {
    BlockPositionChoice,
    ChartPositionChoice,
    compact,
    EnrichedBlockAside,
    EnrichedBlockChart,
    EnrichedBlockChartStory,
    EnrichedBlockFixedGraphic,
    EnrichedBlockGreySection,
    EnrichedBlockHeading,
    EnrichedBlockHorizontalRule,
    EnrichedBlockHtml,
    EnrichedBlockImage,
    EnrichedBlockList,
    EnrichedBlockMissingData,
    EnrichedBlockProminentLink,
    EnrichedBlockPullQuote,
    EnrichedBlockRecirc,
    EnrichedBlockScroller,
    EnrichedBlockSDGGrid,
    EnrichedBlockSDGToc,
    EnrichedBlockAdditionalCharts,
    EnrichedBlockSideBySideContainer,
    EnrichedBlockStickyLeftContainer,
    EnrichedBlockStickyRightContainer,
    EnrichedBlockText,
    EnrichedChartStoryItem,
    EnrichedRecircItem,
    EnrichedScrollerItem,
    EnrichedSDGGridItem,
    isArray,
    OwidEnrichedArticleBlock,
    OwidRawArticleBlock,
    ParseError,
    partition,
    RawBlockAdditionalCharts,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockFixedGraphic,
    RawBlockGreySection,
    RawBlockHeading,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
    RawBlockProminentLink,
    RawBlockPullQuote,
    RawBlockRecirc,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockSideBySideContainer,
    RawBlockStickyLeftContainer,
    RawBlockStickyRightContainer,
    RawBlockText,
    Span,
    SpanSimpleText,
} from "@ourworldindata/utils"
import {
    extractPlaintextUrl,
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
    htmlToSpans,
} from "./gdocUtils.js"
import { match } from "ts-pattern"
import { parseInt } from "lodash"
import { getTitleSupertitleFromHeadingText } from "./gdocToArchieml.js"

export function parseRawBlocksToEnrichedBlocks(
    block: OwidRawArticleBlock
): OwidEnrichedArticleBlock | null {
    return match(block)
        .with({ type: "additional-charts" }, parseAdditionalCharts)
        .with({ type: "aside" }, parseAside)
        .with({ type: "chart" }, parseChart)
        .with({ type: "scroller" }, parseScroller)
        .with({ type: "chart-story" }, parseChartStory)
        .with({ type: "fixed-graphic" }, parseFixedGraphic)
        .with({ type: "image" }, parseImage)
        .with({ type: "list" }, parseList)
        .with({ type: "pull-quote" }, parsePullQuote)
        .with(
            { type: "horizontal-rule" },
            (): EnrichedBlockHorizontalRule => ({
                type: "horizontal-rule",
                parseErrors: [],
            })
        )
        .with({ type: "recirc" }, parseRecirc)
        .with({ type: "text" }, parseText)
        .with(
            { type: "html" },
            (block: RawBlockHtml): EnrichedBlockHtml => ({
                type: "html",
                value: block.value,
                parseErrors: [],
            })
        )
        .with({ type: "url" }, () => null) // url blocks should only occur inside of chart stories etc
        .with({ type: "position" }, () => null) // position blocks should only occur inside of chart stories etc
        .with({ type: "heading" }, parseHeading)
        .with({ type: "sdg-grid" }, parseSdgGrid)
        .with({ type: "sticky-left" }, parseStickyLeft)
        .with({ type: "sticky-right" }, parseStickyRight)
        .with({ type: "side-by-side" }, parseSideBySide)
        .with({ type: "grey-section" }, parseGreySection)
        .with({ type: "prominent-link" }, parseProminentLink)
        .with(
            { type: "sdg-toc" },
            (): EnrichedBlockSDGToc => ({ type: "sdg-toc", parseErrors: [] })
        )
        .with(
            { type: "missing-data" },
            (): EnrichedBlockMissingData => ({
                type: "missing-data",
                parseErrors: [],
            })
        )
        .exhaustive()
}

function parseAdditionalCharts(
    raw: RawBlockAdditionalCharts
): EnrichedBlockAdditionalCharts {
    const createError = (error: ParseError): EnrichedBlockAdditionalCharts => ({
        type: "additional-charts",
        items: [],
        parseErrors: [error],
    })

    if (!isArray(raw.value))
        return createError({ message: "Value is not a list" })

    const items = raw.value.map(htmlToSpans)

    return {
        type: "additional-charts",
        items,
        parseErrors: [],
    }
}

const parseAside = (raw: RawBlockAside): EnrichedBlockAside => {
    const createError = (
        error: ParseError,
        caption: Span[] = [],
        position: BlockPositionChoice | undefined = undefined
    ): EnrichedBlockAside => ({
        type: "aside",
        caption,
        position,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (!raw.value.caption)
        return createError({
            message: "Caption property is missing",
        })

    const position =
        raw.value.position === "left" || raw.value.position === "right"
            ? raw.value.position
            : undefined
    const caption = htmlToSpans(raw.value.caption)

    return {
        type: "aside",
        caption,
        position,
        parseErrors: [],
    }
}

const parseChart = (raw: RawBlockChart): EnrichedBlockChart => {
    const createError = (
        error: ParseError,
        url: string,
        caption: Span[] = []
    ): EnrichedBlockChart => ({
        type: "chart",
        url,
        caption,
        parseErrors: [error],
    })

    const val = raw.value

    if (typeof val === "string") {
        return {
            type: "chart",
            url: val,
            height: undefined,
            row: undefined,
            column: undefined,
            position: undefined,
            caption: [],
            parseErrors: [],
        }
    } else {
        if (!val.url)
            return createError(
                {
                    message: "url property is missing",
                },
                ""
            )

        const url = val.url

        const warnings: ParseError[] = []

        const height = val.height
        const row = val.row
        const column = val.column
        let position: ChartPositionChoice | undefined = undefined
        if (val.position)
            if (val.position === "featured") position = val.position
            else {
                warnings.push({
                    message: "position must be 'featured' or unset",
                })
            }
        const caption = val.caption ? htmlToSpans(val.caption) : []

        return {
            type: "chart",
            url,
            height,
            row,
            column,
            position,
            caption,
            parseErrors: [],
        }
    }
}

const parseScroller = (raw: RawBlockScroller): EnrichedBlockScroller => {
    const createError = (
        error: ParseError,
        blocks: EnrichedScrollerItem[] = []
    ): EnrichedBlockScroller => ({
        type: "scroller",
        blocks,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const blocks: EnrichedScrollerItem[] = []
    let currentBlock: EnrichedScrollerItem = {
        url: "",
        text: { type: "text", value: [], parseErrors: [] },
    }
    const warnings: ParseError[] = []
    for (const block of raw.value) {
        match(block)
            .with({ type: "url" }, (url) => {
                if (currentBlock.url !== "") {
                    blocks.push(currentBlock)
                    currentBlock = {
                        url: "",
                        text: {
                            type: "text",
                            value: [],
                            parseErrors: [],
                        },
                    }
                }
                currentBlock.url = url.value
            })
            .with({ type: "text" }, (text) => {
                currentBlock.text = htmlToEnrichedTextBlock(text.value)
            })
            .otherwise(() =>
                warnings.push({
                    message: "scroller items must be of type 'url' or 'text'",
                    isWarning: true,
                })
            )
    }
    if (currentBlock.url !== "") {
        blocks.push(currentBlock)
    }

    return {
        type: "scroller",
        blocks,
        parseErrors: [],
    }
}

const parseChartStory = (raw: RawBlockChartStory): EnrichedBlockChartStory => {
    const createError = (
        error: ParseError,
        items: EnrichedChartStoryItem[] = []
    ): EnrichedBlockChartStory => ({
        type: "chart-story",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const items: (EnrichedChartStoryItem | ParseError)[] = raw.value.map(
        (item): EnrichedChartStoryItem | ParseError => {
            const chart = item?.chart
            if (typeof item?.narrative !== "string" || item?.narrative === "")
                return {
                    message:
                        "Item is missing narrative property or it is not a string value",
                }
            if (typeof chart !== "string" || item?.chart === "")
                return {
                    message:
                        "Item is missing chart property or it is not a string value",
                }
            return {
                narrative: htmlToEnrichedTextBlock(item.narrative),
                chart: { type: "chart", url: chart, parseErrors: [] },
                technical: item.technical
                    ? item.technical.map(htmlToEnrichedTextBlock)
                    : [],
            }
        }
    )

    const [errors, enrichedItems] = partition(
        items,
        (item): item is ParseError => "message" in item
    )

    return {
        type: "chart-story",
        items: enrichedItems,
        parseErrors: errors,
    }
}

const parseFixedGraphic = (
    raw: RawBlockFixedGraphic
): EnrichedBlockFixedGraphic => {
    const createError = (
        error: ParseError,
        graphic: EnrichedBlockChart | EnrichedBlockImage = {
            type: "image",
            src: "",
            caption: [],
            parseErrors: [],
        },
        text: EnrichedBlockText[] = []
    ): EnrichedBlockFixedGraphic => ({
        type: "fixed-graphic",
        graphic,
        text,
        position: position,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    let position: BlockPositionChoice | undefined = undefined
    let graphic: EnrichedBlockChart | EnrichedBlockImage | undefined = undefined
    const texts: EnrichedBlockText[] = []
    const warnings: ParseError[] = []
    for (const block of raw.value) {
        match(block)
            .with({ type: "chart" }, (chart) => {
                graphic = parseChart(chart)
            })
            .with({ type: "image" }, (chart) => {
                graphic = parseImage(chart)
            })
            .with({ type: "text" }, (text) => {
                texts.push(htmlToEnrichedTextBlock(text.value))
            })
            .with({ type: "position" }, (chart) => {
                if (chart.value === "left" || chart.value === "right")
                    position = chart.value
                else {
                    warnings.push({
                        message: "position must be 'left' or 'right' or unset",
                    })
                }
            })
            .otherwise(() =>
                warnings.push({
                    message:
                        "fixed-graphic items must be of type 'chart', 'image', 'text' or 'position'",
                    isWarning: true,
                })
            )
    }
    if (texts.length === 0 || !graphic)
        return createError({
            message: "fixed-graphic must have a text and a graphic",
        })

    return {
        type: "fixed-graphic",
        graphic,
        position,
        text: texts,
        parseErrors: warnings,
    }
}

const parseImage = (image: RawBlockImage): EnrichedBlockImage => {
    const createError = (
        error: ParseError,
        src: string = "",
        caption: Span[] = []
    ): EnrichedBlockImage => ({
        type: "image",
        src,
        caption,
        parseErrors: [error],
    })

    if (typeof image.value === "string") {
        return {
            type: "image",
            src: image.value,
            caption: [],
            parseErrors: [],
        }
    } else {
        const src = image.value.src
        if (!src)
            return createError({
                message: "Src property is missing or empty",
            })

        const caption =
            image.value?.caption !== undefined
                ? htmlToSpans(image.value.caption)
                : []

        return {
            type: "image",
            caption,
            src,
            parseErrors: [],
        }
    }
}

const parseList = (raw: RawBlockList): EnrichedBlockList => {
    const createError = (
        error: ParseError,
        items: EnrichedBlockText[] = []
    ): EnrichedBlockList => ({
        type: "list",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const items = raw.value.map(htmlToEnrichedTextBlock)

    return {
        type: "list",
        items,
        parseErrors: [],
    }
}

const parseSimpleTextsWithErrors = (
    raw: string[]
): { errors: ParseError[]; texts: SpanSimpleText[] } => {
    const parsedAsBlocks = raw.map(htmlToSimpleTextBlock)
    const errors = parsedAsBlocks.flatMap((block) => block.parseErrors)
    const texts = parsedAsBlocks.map((block) => block.value)
    return { errors, texts }
}

const parsePullQuote = (raw: RawBlockPullQuote): EnrichedBlockPullQuote => {
    const createError = (
        error: ParseError,
        text: SpanSimpleText[] = []
    ): EnrichedBlockPullQuote => ({
        type: "pull-quote",
        text,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const textResults = compact(raw.value.map(parseRawBlocksToEnrichedBlocks))

    const [textBlocks, otherBlocks] = partition(
        textResults,
        (item): item is EnrichedBlockText => item.type === "text"
    )

    const otherBlockErrors = otherBlocks
        .map((block) => block.parseErrors)
        .flat()
    const textBlockErrors = textBlocks.map((block) => block.parseErrors).flat()

    const simpleTextSpans: SpanSimpleText[] = []
    const unexpectedTextSpanErrors: ParseError[] = []

    for (const textBlock of textBlocks)
        for (const span of textBlock.value) {
            if (span.spanType === "span-simple-text") {
                simpleTextSpans.push(span)
            } else {
                unexpectedTextSpanErrors.push({
                    message:
                        "Unexpected span type in pull-quote. Note: formatting is not supported inside pull-quotes ATM.",
                })
            }
        }

    return {
        type: "pull-quote",
        text: simpleTextSpans,
        parseErrors: [
            ...otherBlockErrors,
            ...textBlockErrors,
            ...unexpectedTextSpanErrors,
        ],
    }
}

const parseRecirc = (raw: RawBlockRecirc): EnrichedBlockRecirc => {
    const createError = (
        error: ParseError,
        title: SpanSimpleText = { spanType: "span-simple-text", text: "" },
        items: EnrichedRecircItem[] = []
    ): EnrichedBlockRecirc => ({
        type: "recirc",
        title,
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (raw.value.length === 0)
        return createError({
            message: "Recirc must have at least one item",
        })

    const title = raw.value[0].title
    if (!title)
        return createError({
            message: "Title property is missing or empty",
        })

    if (!raw.value[0].list)
        return createError({
            message: "Recirc must have at least one entry",
        })

    const items: (EnrichedRecircItem | ParseError[])[] = raw.value[0].list.map(
        (item): EnrichedRecircItem | ParseError[] => {
            if (typeof item?.article !== "string")
                return [
                    {
                        message:
                            "Item is missing article property or it is not a string value",
                    },
                ]
            if (typeof item?.author !== "string")
                return [
                    {
                        message:
                            "Item is missing author property or it is not a string value",
                    },
                ]
            if (typeof item?.url !== "string")
                return [
                    {
                        message:
                            "Item is missing url property or it is not a string value",
                    },
                ]

            const article = htmlToSimpleTextBlock(item.article)
            const author = htmlToSimpleTextBlock(item.author)

            const errors = article.parseErrors.concat(author.parseErrors)

            if (errors.length > 0) return errors

            return {
                url: item.url,
                article: article.value,
                author: author.value,
            }
        }
    )

    const [errors, enrichedItems] = partition(
        items,
        (item: EnrichedRecircItem | ParseError[]): item is ParseError[] =>
            isArray(item)
    )

    const flattenedErrors = errors.flat()
    const parsedTitle = htmlToSimpleTextBlock(title)

    return {
        type: "recirc",
        title: parsedTitle.value,
        items: enrichedItems,
        parseErrors: [...flattenedErrors, ...parsedTitle.parseErrors],
    }
}

const parseText = (raw: RawBlockText): EnrichedBlockText => {
    const createError = (
        error: ParseError,
        value: Span[] = []
    ): EnrichedBlockText => ({
        type: "text",
        value,
        parseErrors: [error],
    })

    if (typeof raw.value !== "string")
        return createError({
            message: "Value is a not a string",
        })

    const value = htmlToSpans(raw.value)

    return {
        type: "text",
        value,
        parseErrors: [],
    }
}

const parseHeading = (raw: RawBlockHeading): EnrichedBlockHeading => {
    const createError = (
        error: ParseError,
        text: SpanSimpleText = { spanType: "span-simple-text", text: "" },
        level: number = 1
    ): EnrichedBlockHeading => ({
        type: "heading",
        text,
        level,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const headingText = raw.value.text
    if (!headingText)
        return createError({
            message: "Text property is missing",
        })
    const headingSpans = parseSimpleTextsWithErrors([headingText])

    if (headingSpans.texts.length !== 1)
        return createError({
            message:
                "Text did not result in exactly one simple span - did you apply formatting?",
        })

    if (!raw.value.level)
        return createError({
            message: "Header level property is missing",
        })
    const level = parseInt(raw.value.level, 10)
    if (level < 1 || level > 6)
        return createError({
            message:
                "Header level property is outside the valid range between 1 and 6",
        })

    const [title, supertitle] = getTitleSupertitleFromHeadingText(
        headingSpans.texts[0].text
    )

    return {
        type: "heading",
        text: {
            spanType: "span-simple-text",
            text: title,
        },
        supertitle: supertitle
            ? {
                  spanType: "span-simple-text",
                  text: supertitle,
              }
            : undefined,
        level: level,
        parseErrors: [],
    }
}

const parseSdgGrid = (raw: RawBlockSDGGrid): EnrichedBlockSDGGrid => {
    const createError = (
        error: ParseError,
        items: EnrichedSDGGridItem[] = []
    ): EnrichedBlockSDGGrid => ({
        type: "sdg-grid",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (raw.value.length === 0)
        return createError({
            message: "SDG Grid must have at least one item",
        })

    if (!raw.value)
        return createError({
            message: "SDG Grid must have at least one entry",
        })

    const items: (EnrichedSDGGridItem | ParseError[])[] = raw.value.map(
        (item): EnrichedSDGGridItem | ParseError[] => {
            if (typeof item?.goal !== "string")
                return [
                    {
                        message:
                            "Item is missing goal property or it is not a string value",
                    },
                ]
            if (typeof item?.link !== "string")
                return [
                    {
                        message:
                            "Item is missing link property or it is not a string value",
                    },
                ]
            // TODO: make the type not just a string and then parse spans here
            const goal = item.goal!
            const link = item.link!

            //const errors = goal.parseErrors.concat(link.parseErrors)

            //if (errors.length > 0) return errors

            return {
                goal,
                link,
            }
        }
    )

    const [errors, enrichedItems] = partition(
        items,
        (item: EnrichedSDGGridItem | ParseError[]): item is ParseError[] =>
            isArray(item)
    )

    const flattenedErrors = errors.flat()

    return {
        type: "sdg-grid",
        items: enrichedItems,
        parseErrors: [...flattenedErrors],
    }
}

function parseStickyRight(
    raw: RawBlockStickyRightContainer
): EnrichedBlockStickyRightContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedArticleBlock[] = [],
        right: OwidEnrichedArticleBlock[] = []
    ): EnrichedBlockStickyRightContainer => ({
        type: "sticky-right",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (!left.length || !right.length) {
        return createError({
            message: "Empty column in the sticky right container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "sticky-right",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseStickyLeft(
    raw: RawBlockStickyLeftContainer
): EnrichedBlockStickyLeftContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedArticleBlock[] = [],
        right: OwidEnrichedArticleBlock[] = []
    ): EnrichedBlockStickyLeftContainer => ({
        type: "sticky-left",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (!left.length || !right.length) {
        return createError({
            message: "Empty column in the sticky left container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "sticky-left",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseSideBySide(
    raw: RawBlockSideBySideContainer
): EnrichedBlockSideBySideContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedArticleBlock[] = [],
        right: OwidEnrichedArticleBlock[] = []
    ): EnrichedBlockSideBySideContainer => ({
        type: "side-by-side",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (!left.length || !right.length) {
        return createError({
            message: "Empty column in the side-by-side container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "side-by-side",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseGreySection(raw: RawBlockGreySection): EnrichedBlockGreySection {
    return {
        type: "grey-section",
        items: compact(raw.value.map(parseRawBlocksToEnrichedBlocks)),
        parseErrors: [],
    }
}

function parseProminentLink(
    raw: RawBlockProminentLink
): EnrichedBlockProminentLink {
    const createError = (error: ParseError): EnrichedBlockProminentLink => ({
        type: "prominent-link",
        parseErrors: [error],
        title: "",
        url: "",
        description: "",
    })

    if (!raw.value.url) {
        return createError({ message: "No url given for the prominent link" })
    }

    if (!raw.value.title) {
        return createError({ message: "No title given for the prominent link" })
    }

    const url = extractPlaintextUrl(raw.value.url)

    return {
        type: "prominent-link",
        parseErrors: [],
        title: raw.value.title,
        url,
        description: raw.value.description || "",
    }
}
