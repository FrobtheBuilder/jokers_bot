import fs = require("fs")
import path = require("path")
import util = require("util")
import moment from "moment"
import Twitter = require("twitter-lite")
import config = require("../config.json")

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

interface TrickState {
    nextIndex: number,
    nextTrickTime: number | null,
    mode: "sequential" | "random",
    count: number
}

const dataDir = path.resolve(__dirname, "../data")

const client = new Twitter({
    consumer_key: config.apiKey,
    consumer_secret: config.apiSecretKey,
    access_token_key: config.accessToken,
    access_token_secret: config.accessTokenSecret
})

async function loadTrickState(): Promise<TrickState> {
    try {
        return JSON.parse(
            await readFile(path.resolve(dataDir, "trickstate.json"), {encoding: "utf-8"})
        )
    }
    catch (e) {
        return {nextIndex: 0, nextTrickTime: null, mode: "sequential", count: 0}
    }
}

async function loadTricks(): Promise<string[]> {
    const trickText = await readFile(path.resolve(__dirname, "..", config.trickFile), {encoding: "utf-8"})
    if (trickText.includes("\r\n")) {
        return trickText.split("\r\n\r\n\r\n")
    }
    return trickText.split("\n\n\n")
}

async function saveTrickState(state: TrickState) {
    await writeFile(
        path.resolve(dataDir, "trickstate.json"),
        JSON.stringify(state, undefined, 2),
        {encoding: "utf-8"}
    )
}

async function init() {
    const trickState = await loadTrickState()
    setInterval(() => {
        if (trickState.nextTrickTime === null || moment().valueOf() > trickState.nextTrickTime) {
            trick(trickState)
        }
    }, 1000)
}

async function trick(state: TrickState) {
    const tricks = await loadTricks() //reload tricks each trick for hot-editing

    // if we're in random mode and some new tricks have been added
    // switch to sequential mode and pick up at the next trick
    if (state.mode == "random" && state.count < tricks.length) {
        state.mode = "sequential"
        state.nextIndex = state.count
    }
    
    console.log("Posting trick:")
    console.log(`"${tricks[state.nextIndex]}"`)
    
    await client.post("statuses/update", {status: tricks[state.nextIndex], source: "Joker's Trick"})
    

    // switch to random mode if we run out of tricks, or only one was added
    if (state.mode == "sequential" && state.nextIndex + 1 >= tricks.length) {
        state.mode = "random"
    }
    
    //advance trick index according to mode
    if (state.mode == "random") {
        state.nextIndex = Math.floor(Math.random() * tricks.length)
        console.log("Out of tricks, picking next trick at random.")
    }
    else {
        state.nextIndex = state.nextIndex + 1
        const tricksLeft = tricks.length - state.nextIndex
        console.log(`${tricksLeft} ${tricksLeft > 1 ? "tricks" : "trick"} left.`)
    }
    console.log("")

    state.count = tricks.length
    const [quantity, unit] = config.interval.split(" ")

    state.nextTrickTime = moment().add(Number(quantity), unit as any).valueOf()
    await saveTrickState(state)
}

init()