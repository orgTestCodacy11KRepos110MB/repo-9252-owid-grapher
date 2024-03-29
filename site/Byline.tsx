import React from "react"
import { formatAuthors } from "./clientFormatting.js"

export const Byline = ({
    authors,
    withMax,
    override,
}: {
    authors: string[]
    withMax: boolean
    override?: string
}) => {
    return (
        <div className="authors-byline">
            {override ? (
                <div
                    dangerouslySetInnerHTML={{
                        __html: override,
                    }}
                ></div>
            ) : (
                <a href="/team">{`by ${formatAuthors({
                    authors,
                    requireMax: withMax,
                })}`}</a>
            )}
        </div>
    )
}
