import { Tag as TagReactTagAutocomplete } from "react-tag-autocomplete"

// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO: number = 1.8

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export type Integer = number
// TODO: remove duplicate definition, also available in CoreTable
export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum SortBy {
    custom = "custom",
    entityName = "entityName",
    column = "column",
    total = "total",
}

export interface SortConfig {
    sortBy?: SortBy
    sortOrder?: SortOrder
    sortColumnSlug?: string
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]

export type PrimitiveType = number | string | boolean
export type ValueRange = [number, number]

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface RelatedChart {
    title: string
    slug: string
    variantName?: string | null
    isKey?: boolean
}

export type OwidVariableId = Integer // remove.

export const BLOCK_WRAPPER_DATATYPE = "block-wrapper"

export interface FormattedPost extends FullPost {
    supertitle?: string
    stickyNavLinks?: { text: string; target: string }[]
    lastUpdated?: string
    byline?: string
    info?: string
    html: string
    style?: string
    footnotes: string[]
    tocHeadings: TocHeading[]
    pageDesc: string
}

export enum SubNavId {
    about = "about",
    biodiversity = "biodiversity",
    coronavirus = "coronavirus",
    co2 = "co2",
    energy = "energy",
    forests = "forests",
    water = "water",
    explorers = "explorers",
}

export interface FormattingOptions {
    toc?: boolean
    hideAuthors?: boolean
    bodyClassName?: string
    subnavId?: SubNavId
    subnavCurrentId?: string
    raw?: boolean
    hideDonateFooter?: boolean
    footnotes?: boolean
}

export interface KeyValueProps {
    [key: string]: string | boolean | undefined
}

export interface DataValueQueryArgs {
    variableId?: number
    entityId?: number
    chartId?: number
    year?: number
}

export interface DataValueConfiguration {
    queryArgs: DataValueQueryArgs
    template: string
}

export interface DataValueResult {
    value: number
    year: number
    unit?: string
    entityName: string
}

export interface DataValueProps extends DataValueResult {
    formattedValue?: string
    template: string
}

export interface GitCommit {
    author_email: string
    author_name: string
    body: string
    date: string
    hash: string
    message: string
}

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}

export interface TocHeading {
    text: string
    html?: string // used by SectionHeading toc. Excluded from LongFormPage toc.
    slug: string
    isSubheading: boolean
}

export interface TocHeadingWithTitleSupertitle extends TocHeading {
    title: string
    supertitle?: string
}

// todo; remove
export interface PostRow {
    id: number
    title: string
    slug: string
    type: WP_PostType
    status: string
    content: string
    published_at: Date | null
    updated_at: Date
    archieml: string
    archieml_update_statistics: string
    gdocSuccessorId: string
}

export interface Tag extends TagReactTagAutocomplete {
    isKey?: boolean
}

export interface EntryMeta {
    slug: string
    title: string
    excerpt: string
    kpi: string
}

export interface CategoryWithEntries {
    name: string
    slug: string
    entries: EntryMeta[]
    subcategories: CategoryWithEntries[]
}

export enum WP_PostType {
    Post = "post",
    Page = "page",
}

export interface EntryNode {
    slug: string
    title: string
    // in some edge cases (entry alone in a subcategory), WPGraphQL returns
    // null instead of an empty string)
    excerpt: string | null
    kpi: string
}

export type TopicId = number

export enum GraphDocumentType {
    Topic = "topic",
    Article = "article",
}

export interface AlgoliaRecord {
    id: number
    title: string
    type: GraphType | GraphDocumentType
    image?: string
}

export interface DocumentNode {
    id: number
    title: string
    slug: string
    content: string | null // if content is empty
    type: GraphDocumentType
    image: string | null
    parentTopics: Array<TopicId>
}

export interface CategoryNode {
    name: string
    slug: string
    pages: any
    children: any
}

export enum GraphType {
    Document = "document",
    Chart = "chart",
}

export interface ChartRecord {
    id: number
    title: string
    slug: string
    type: GraphType.Chart
    parentTopics: Array<TopicId>
}

export interface PostReference {
    id: number
    title: string
    slug: string
}

export type FilterFnPostRestApi = (post: PostRestApi) => boolean

export interface PostRestApi {
    slug: string
    meta: {
        owid_publication_context_meta_field?: {
            immediate_newsletter?: boolean
            homepage?: boolean
            latest?: boolean
        }
    }
}

export interface KeyInsight {
    title: string
    isTitleHidden?: boolean
    content: string
    slug: string
}

export interface IndexPost {
    title: string
    slug: string
    date: Date
    modifiedDate: Date
    authors: string[]
    excerpt?: string
    imageUrl?: string
}

export interface FullPost extends IndexPost {
    id: number
    type: WP_PostType
    path: string
    content: string
    thumbnailUrl?: string
    imageId?: number
    postId?: number
    relatedCharts?: RelatedChart[]
    glossary: boolean
}

export enum WP_ColumnStyle {
    StickyRight = "sticky-right",
    StickyLeft = "sticky-left",
    SideBySide = "side-by-side",
}

export enum WP_BlockClass {
    FullContentWidth = "wp-block-full-content-width", // not an actual WP block yet
}

export enum WP_BlockType {
    AllCharts = "all-charts",
}

export enum SuggestedChartRevisionStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected",
    flagged = "flagged",
}

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    status: number
    constructor(message: string, status?: number) {
        super(message)
        this.status = status || 400
    }
}

export enum DeployStatus {
    queued = "queued",
    pending = "pending",
    // done = "done"
}

export interface DeployChange {
    timeISOString?: string
    authorName?: string
    authorEmail?: string
    message?: string
    slug?: string
}

export interface Deploy {
    status: DeployStatus
    changes: DeployChange[]
}

export interface Annotation {
    entityName?: string
    year?: number
}

export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

// see CoreTableConstants.ts
export type ColumnSlug = string // a url friendly name for a column in a table. cannot have spaces

export enum Position {
    top = "top",
    right = "right",
    bottom = "bottom",
    left = "left",
}

export type PositionMap<Value> = {
    [key in Position]?: Value
}

export enum HorizontalAlign {
    left = "left",
    center = "center",
    right = "right",
}

export enum VerticalAlign {
    top = "top",
    middle = "middle",
    bottom = "bottom",
}

export enum AxisAlign {
    start = "start",
    middle = "middle",
    end = "end",
}

export interface GridParameters {
    rows: number
    columns: number
}

export type SpanSimpleText = {
    spanType: "span-simple-text"
    text: string
}

export type SpanFallback = {
    spanType: "span-fallback"
    children: Span[]
}

export type SpanLink = {
    spanType: "span-link"
    children: Span[]
    url: string
}

export type SpanRef = {
    spanType: "span-ref"
    children: Span[]
    url: string
}

export type SpanNewline = {
    spanType: "span-newline"
}

export type SpanItalic = {
    spanType: "span-italic"
    children: Span[]
}

export type SpanBold = {
    spanType: "span-bold"
    children: Span[]
}

export type SpanUnderline = {
    spanType: "span-underline"
    children: Span[]
}

export type SpanSubscript = {
    spanType: "span-subscript"
    children: Span[]
}

export type SpanSuperscript = {
    spanType: "span-superscript"
    children: Span[]
}

export type SpanQuote = {
    spanType: "span-quote"
    children: Span[]
}
export type UnformattedSpan = SpanSimpleText | SpanNewline

export type Span =
    | SpanSimpleText
    | SpanLink
    | SpanRef
    | SpanNewline
    | SpanItalic
    | SpanBold
    | SpanUnderline
    | SpanSubscript
    | SpanSuperscript
    | SpanQuote
    | SpanFallback

export type BlockPositionChoice = "right" | "left"
export type ChartPositionChoice = "featured"

type ArchieMLUnexpectedNonObjectValue = string

export type ParseError = {
    message: string
    isWarning?: boolean
}

export type EnrichedBlockWithParseErrors = {
    parseErrors: ParseError[]
}

export type RawBlockAsideValue = {
    position?: string // use BlockPositionChoice in matching Enriched block
    caption?: string
}

export type RawBlockAside = {
    type: "aside"
    value: RawBlockAsideValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockAside = {
    type: "aside"
    position?: BlockPositionChoice
    caption: Span[]
} & EnrichedBlockWithParseErrors

export type RawBlockChartValue = {
    url?: string
    height?: string
    row?: string
    column?: string
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    caption?: string
}
export type RawBlockChart = {
    type: "chart"
    value: RawBlockChartValue | string
}

export type EnrichedBlockChart = {
    type: "chart"
    url: string
    height?: string
    row?: string
    column?: string
    position?: ChartPositionChoice
    caption?: Span[]
} & EnrichedBlockWithParseErrors

export type RawBlockScroller = {
    type: "scroller"
    value: OwidRawArticleBlock[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedScrollerItem = {
    url: string // TODO: should this be transformed into an EnrichedBlockChart?
    text: EnrichedBlockText
}

export type EnrichedBlockScroller = {
    type: "scroller"
    blocks: EnrichedScrollerItem[]
} & EnrichedBlockWithParseErrors

export type RawChartStoryValue = {
    narrative?: string
    chart?: string
    technical?: string[]
}

export type RawBlockChartStory = {
    type: "chart-story"
    value: RawChartStoryValue[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedChartStoryItem = {
    narrative: EnrichedBlockText
    chart: EnrichedBlockChart
    technical: EnrichedBlockText[]
}

export type EnrichedBlockChartStory = {
    type: "chart-story"
    items: EnrichedChartStoryItem[]
} & EnrichedBlockWithParseErrors

export type RawBlockFixedGraphic = {
    type: "fixed-graphic"
    value: OwidRawArticleBlock[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockFixedGraphic = {
    type: "fixed-graphic"
    graphic: EnrichedBlockChart | EnrichedBlockImage
    position?: BlockPositionChoice
    text: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
export type RawBlockImageValue = {
    src?: string
    caption?: string
}
export type RawBlockImage = {
    type: "image"
    value: RawBlockImageValue | string
}

export type EnrichedBlockImage = {
    type: "image"
    src: string
    caption: Span[]
} & EnrichedBlockWithParseErrors

// TODO: This is what lists staring with * are converted to in gdocToArhcieml
// It might also be what is used inside recirc elements but there it's not a simple
// string IIRC - check this
export type RawBlockList = {
    type: "list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockList = {
    type: "list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type RawBlockNumberedList = {
    type: "numbered-list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockNumberedList = {
    type: "numbered-list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type RawBlockPullQuote = {
    type: "pull-quote"
    value: OwidRawArticleBlock[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockPullQuote = {
    type: "pull-quote"
    text: SpanSimpleText[]
} & EnrichedBlockWithParseErrors

export type RawBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
}

export type EnrichedBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors

export type RawRecircItem = {
    article?: string
    author?: string
    url?: string
}

export type RawBlockRecircValue = {
    title?: string
    list?: RawRecircItem[]
}
export type RawBlockRecirc = {
    type: "recirc"
    value: RawBlockRecircValue[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedRecircItem = {
    article: SpanSimpleText
    author: SpanSimpleText
    url: string
}

export type EnrichedBlockRecirc = {
    type: "recirc"
    title: SpanSimpleText
    items: EnrichedRecircItem[]
} & EnrichedBlockWithParseErrors

export type RawBlockText = {
    type: "text"
    value: string
}

export type EnrichedBlockText = {
    type: "text"
    value: Span[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockSimpleText = {
    type: "simple-text"
    value: SpanSimpleText
} & EnrichedBlockWithParseErrors
export type RawBlockHtml = {
    type: "html"
    value: string
}

export type EnrichedBlockHtml = {
    type: "html"
    value: string
} & EnrichedBlockWithParseErrors
export type RawBlockUrl = {
    type: "url"
    value: string
}
// There is no EnrichedBlockUrl because Url blocks only exist inside Sliders;
// they are subsumed into Slider blocks during enrichment
export type RawBlockPosition = {
    type: "position"
    value: string
}
// There is no EnrichedBlockUrl because Position blocks only exist inside FixedGraphics;
// they are subsumed into FixedGraphic blocks during enrichment
export type RawBlockHeadingValue = {
    text?: string
    level?: string
}
export type RawBlockHeading = {
    type: "heading"
    value: RawBlockHeadingValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockHeading = {
    type: "heading"
    text: Span[]
    supertitle?: Span[]
    level: number
} & EnrichedBlockWithParseErrors

export type RawSDGGridItem = {
    goal?: string
    link?: string
}

export type RawBlockSDGGrid = {
    type: "sdg-grid"
    value: RawSDGGridItem[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedSDGGridItem = {
    goal: string
    link: string
}

export type EnrichedBlockSDGGrid = {
    type: "sdg-grid"
    items: EnrichedSDGGridItem[]
} & EnrichedBlockWithParseErrors

export type RawBlockStickyRightContainer = {
    type: "sticky-right"
    value: {
        left: OwidRawArticleBlock[]
        right: OwidRawArticleBlock[]
    }
}

export type EnrichedBlockStickyRightContainer = {
    type: "sticky-right"
    left: OwidEnrichedArticleBlock[]
    right: OwidEnrichedArticleBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockStickyLeftContainer = {
    type: "sticky-left"
    value: {
        left: OwidRawArticleBlock[]
        right: OwidRawArticleBlock[]
    }
}

export type EnrichedBlockStickyLeftContainer = {
    type: "sticky-left"
    left: OwidEnrichedArticleBlock[]
    right: OwidEnrichedArticleBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockSideBySideContainer = {
    type: "side-by-side"
    value: {
        left: OwidRawArticleBlock[]
        right: OwidRawArticleBlock[]
    }
}

export type EnrichedBlockSideBySideContainer = {
    type: "side-by-side"
    left: OwidEnrichedArticleBlock[]
    right: OwidEnrichedArticleBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockGraySection = {
    type: "gray-section"
    value: OwidRawArticleBlock[]
}

export type EnrichedBlockGraySection = {
    type: "gray-section"
    items: OwidEnrichedArticleBlock[]
} & EnrichedBlockWithParseErrors

export type ProminentLinkValue = {
    url?: string
    title?: string
    description?: string
}

export type RawBlockProminentLink = {
    type: "prominent-link"
    value: ProminentLinkValue
}

export type EnrichedBlockProminentLink = {
    type: "prominent-link"
    url: string
    title: string
    description?: string
} & EnrichedBlockWithParseErrors

export type RawBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
}

export type EnrichedBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors

export type RawBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
}

export type EnrichedBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors

export type RawBlockAdditionalCharts = {
    type: "additional-charts"
    value: string[]
}

export type EnrichedBlockAdditionalCharts = {
    type: "additional-charts"
    items: Span[][]
} & EnrichedBlockWithParseErrors

export type OwidRawArticleBlock =
    | RawBlockAside
    | RawBlockChart
    | RawBlockScroller
    | RawBlockChartStory
    | RawBlockFixedGraphic
    | RawBlockImage
    | RawBlockList
    | RawBlockPullQuote
    | RawBlockRecirc
    | RawBlockText
    | RawBlockUrl
    | RawBlockPosition
    | RawBlockHeading
    | RawBlockHtml
    | RawBlockHorizontalRule
    | RawBlockSDGGrid
    | RawBlockStickyRightContainer
    | RawBlockStickyLeftContainer
    | RawBlockSideBySideContainer
    | RawBlockGraySection
    | RawBlockProminentLink
    | RawBlockSDGToc
    | RawBlockMissingData
    | RawBlockAdditionalCharts
    | RawBlockNumberedList

export type OwidEnrichedArticleBlock =
    | EnrichedBlockText
    | EnrichedBlockAside
    | EnrichedBlockChart
    | EnrichedBlockScroller
    | EnrichedBlockChartStory
    | EnrichedBlockFixedGraphic
    | EnrichedBlockImage
    | EnrichedBlockList
    | EnrichedBlockPullQuote
    | EnrichedBlockRecirc
    | EnrichedBlockHeading
    | EnrichedBlockHtml
    | EnrichedBlockHorizontalRule
    | EnrichedBlockSDGGrid
    | EnrichedBlockStickyRightContainer
    | EnrichedBlockStickyLeftContainer
    | EnrichedBlockSideBySideContainer
    | EnrichedBlockGraySection
    | EnrichedBlockProminentLink
    | EnrichedBlockSDGToc
    | EnrichedBlockMissingData
    | EnrichedBlockAdditionalCharts
    | EnrichedBlockNumberedList
    | EnrichedBlockSimpleText

export enum OwidArticlePublicationContext {
    unlisted = "unlisted",
    listed = "listed",
}

export interface OwidArticleType {
    id: string
    slug: string
    content: OwidArticleContent
    published: boolean
    createdAt: Date
    publishedAt: Date | null
    updatedAt: Date | null
    publicationContext: OwidArticlePublicationContext
}

// see also: getArticleFromJSON()
export interface OwidArticleTypeJSON
    extends Omit<OwidArticleType, "createdAt" | "publishedAt" | "updatedAt"> {
    createdAt: string
    publishedAt: string | null
    updatedAt: string | null
}

/**
 * See ../adminSiteClient/gdocsValidation/getErrors() where these existence
 * constraints are surfaced at runtime on the draft article
 */
export interface OwidArticleTypePublished extends OwidArticleType {
    publishedAt: Date
    updatedAt: Date
    content: OwidArticleContentPublished
}

export interface OwidArticleContent {
    body?: OwidEnrichedArticleBlock[]
    title?: string
    supertitle?: string
    subtitle?: string
    template?: string
    byline?: string
    dateline?: string
    excerpt?: string
    refs?: EnrichedBlockText[]
    summary?: EnrichedBlockText[]
    citation?: EnrichedBlockSimpleText[]
    toc?: TocHeadingWithTitleSupertitle[]
    "cover-image"?: any
    "cover-color"?:
        | "sdg-color-1"
        | "sdg-color-2"
        | "sdg-color-3"
        | "sdg-color-4"
        | "sdg-color-5"
        | "sdg-color-6"
        | "sdg-color-7"
        | "sdg-color-8"
        | "sdg-color-9"
        | "sdg-color-10"
        | "sdg-color-11"
        | "sdg-color-12"
        | "sdg-color-13"
        | "sdg-color-14"
        | "sdg-color-15"
        | "sdg-color-16"
        | "sdg-color-17"
    "featured-image"?: any
}

export interface OwidArticleContentPublished extends OwidArticleContent {
    body: OwidEnrichedArticleBlock[]
    title: string
    byline: string
    excerpt: string
}

export type GdocsPatch = Partial<OwidArticleType>

export enum GdocsContentSource {
    Internal = "internal",
    Gdocs = "gdocs",
}

export enum SiteFooterContext {
    gdocsPreview = "gdocsPreview", // the previewed version (in the admin)
    gdocsArticle = "gdocsArticle", // the rendered version (on the site)
    grapherPage = "grapherPage",
    explorerPage = "explorerPage",
    default = "default",
}
