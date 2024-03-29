#! /usr/bin/env jest

import React from "react"
import { ExplorerControlType } from "./ExplorerConstants.js"
import { ExplorerControlPanel } from "./ExplorerControls.js"

import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

describe(ExplorerControlPanel, () => {
    const options = [
        {
            label: "Paper",
            available: true,
            value: "paper",
        },
        {
            label: "Plastic",
            available: true,
            value: "plastic",
        },
    ]

    const element = mount(
        <ExplorerControlPanel
            choice={{
                title: "Some decision",
                value: "",
                options,
                type: ExplorerControlType.Radio,
            }}
            explorerSlug="explorer_slug"
            isMobile={false}
        />
    )

    it("renders options", () => {
        expect(element.find(`.AvailableOption`).length).toEqual(2)
    })
})
