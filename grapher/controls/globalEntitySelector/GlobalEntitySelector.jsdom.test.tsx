/**
 * @vitest-environment happy-dom
 */
import { it, describe, expect, test } from "vitest"

import React from "react"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
import { GlobalEntitySelector } from "./GlobalEntitySelector.js"
import { SelectionArray } from "../../selection/SelectionArray.js"
enzyme.configure({ adapter: new Adapter() })

describe("when you render a GlobalEntitySelector", () => {
    test("something renders", () => {
        const view = enzyme.shallow(
            <GlobalEntitySelector selection={new SelectionArray()} />
        )
        expect(view.find(".global-entity-control")).not.toHaveLength(0)
    })

    test("graphers/explorers are properly updated", () => {
        const grapherSelection = new SelectionArray()
        const explorerSelection = new SelectionArray()

        const graphersToUpdate = new Set([grapherSelection, explorerSelection])

        const selector = new GlobalEntitySelector({
            selection: new SelectionArray(),
            graphersAndExplorersToUpdate: graphersToUpdate,
        })

        selector.updateSelection(["Breckistan"])

        expect(grapherSelection.selectedEntityNames).toEqual(["Breckistan"])
        expect(explorerSelection.selectedEntityNames).toEqual(["Breckistan"])
    })
})
