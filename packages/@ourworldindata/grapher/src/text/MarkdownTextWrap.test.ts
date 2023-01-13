#! /usr/bin/env jest

import { FontFamily } from "@ourworldindata/utils"
import {
    IRText,
    MarkdownTextWrap,
    getLineWidth,
    recursiveMergeTextTokens,
    IRWhitespace,
    IRBold,
} from "./MarkdownTextWrap"

describe("MarkdownTextWrap", () => {
    it("heavier fontWeight should be wider than plain IRText", () => {
        const string = "abcdefghijklmnopqrstuvwxyz"

        const text = new IRText(string)
        const bold = new IRText(string, { fontWeight: 700 })

        expect(text.width).toBeLessThan(bold.width)
    })

    it("should render bold and calculate that it is wider", () => {
        const plainString = "abcdefghijklmnopqrstuvwxyz"
        const boldString = "**abcdefghijklmnopqrstuvwxyz**"

        const plainMarkdownTextWrap = new MarkdownTextWrap({
            text: plainString,
            fontSize: 14,
            maxWidth: 200,
        })
        const boldMarkdownTextWrap = new MarkdownTextWrap({
            text: boldString,
            fontSize: 14,
            maxWidth: 200,
        })

        const plainWidth = getLineWidth(plainMarkdownTextWrap.htmlLines[0])
        const boldWidth = getLineWidth(boldMarkdownTextWrap.htmlLines[0])
        expect(plainWidth).toBeLessThan(boldWidth)
    })

    it("should accept and apply fontParams", () => {
        const element = new MarkdownTextWrap({
            text: "abcdefghijklmnopqrstuvwxyz",
            fontSize: 14,
            maxWidth: 200,
            fontFamily: FontFamily["comic sans ms"],
            fontWeight: 800,
        })

        const output = element.renderHTML()

        expect(output?.props.style).toMatchObject({
            fontFamily: FontFamily["comic sans ms"],
            fontWeight: 800,
            fontSize: 14,
        })
    })

    it("should calculate height correctly", () => {
        const element = new MarkdownTextWrap({
            text: "a\nb\nc",
            fontSize: 10,
            lineHeight: 1.5,
        })

        // 10 fontSize * 1.5 lineHeight * 3 lines = 45px
        expect(element.height).toEqual(45)
    })

    it("should return zero height for empty string", () => {
        const element = new MarkdownTextWrap({
            text: "",
            fontSize: 16,
        })

        expect(element.height).toEqual(0)
    })

    it("should split on newline", () => {
        const element = new MarkdownTextWrap({
            text: "_test\n**\nnewline\n**_test",
            fontSize: 10,
            lineHeight: 1,
        })

        expect(element.height).toEqual(40)
    })

    describe(recursiveMergeTextTokens, () => {
        it("should merge adjacent text tokens", () => {
            const tokens = [
                new IRText("one"),
                new IRWhitespace(),
                new IRText("two"),
            ]

            const merged = recursiveMergeTextTokens(tokens)
            expect(merged.length).toEqual(1)
            expect(merged[0].toPlaintext()).toEqual("one two")
        })

        it("should merge inside complicated tokens", () => {
            const tokens = [
                new IRBold([
                    new IRText("one"),
                    new IRWhitespace(),
                    new IRText("two"),
                ]),
                new IRText("three"),
                new IRText("four"),
            ]

            const merged = recursiveMergeTextTokens(tokens)
            expect(merged.length).toEqual(2)

            const [boldNode, textNode] = merged as [IRBold, IRText]
            expect(boldNode).toBeInstanceOf(IRBold)
            expect(textNode).toBeInstanceOf(IRText)

            expect(boldNode.toPlaintext()).toEqual("one two")
            expect(textNode.toPlaintext()).toEqual("threefour")

            expect(boldNode.children.length).toEqual(1)
        })
    })
})
