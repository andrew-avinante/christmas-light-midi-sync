import { partition } from "lodash"
import groupBy from "lodash/groupBy"
import {
  AnyEvent,
  EndOfTrackEvent,
  MidiFile,
  NoteOffEvent,
  NoteOnEvent,
  SetTempoEvent,
  StreamSource,
  read,
  write as writeMidiFile,
} from "midifile-ts"
import { toJS } from "mobx"
import { downloadBlob } from "../helpers/Downloader"
import { isNotNull } from "../helpers/array"
import { addDeltaTime, toRawEvents } from "../helpers/toRawEvents"
import {
  addTick,
  tickedEventsToTrackEvents,
  toTrackEvents,
} from "../helpers/toTrackEvents"
import Song from "../song"
import Track, { AnyEventFeature } from "../track"
import { createCommand } from "./Command"

interface Times {
  [key: string]: number;
}

const CHANNELS = [
  "garage",
  "top-right",
  "bottom-right",
  "col-1",
  "col-2",
  "col-3",
  "window",
  "outline",
  "garden",
  "tree"
]

const trackFromMidiEvents = (events: AnyEvent[]): Track => {
  const track = new Track()

  const channel = findChannel(events)
  if (channel !== undefined) {
    track.channel = channel
  }
  
  track.addEvents(toTrackEvents(events))

  return track
}

const tracksFromFormat0Events = (events: AnyEvent[]): Track[] => {
  const tickedEvents = addTick(events)
  const eventsPerChannel = groupBy(tickedEvents, (e) => {
    if ("channel" in e) {
      return e.channel + 1
    }
    return 0 // conductor track
  })
  const tracks: Track[] = []
  for (const channel of Object.keys(eventsPerChannel)) {
    const events = eventsPerChannel[channel]
    const ch = parseInt(channel)
    while (tracks.length <= ch) {
      const track = new Track()
      track.channel = ch > 0 ? ch - 1 : undefined
      tracks.push(track)
    }
    const track = tracks[ch]

    const trackEvents = tickedEventsToTrackEvents(events)
    track.addEvents(trackEvents)
  }
  return tracks
}

const findChannel = (events: AnyEvent[]) => {
  const chEvent = events.find((e) => {
    return e.type === "channel"
  })
  if (chEvent !== undefined && "channel" in chEvent) {
    return chEvent.channel
  }
  return undefined
}

const isConductorTrack = (track: AnyEvent[]) => findChannel(track) === undefined

const isConductorEvent = (e: AnyEventFeature) =>
  "subtype" in e && (e.subtype === "timeSignature" || e.subtype === "setTempo")

export const createConductorTrackIfNeeded = (
  tracks: AnyEvent[][],
): AnyEvent[][] => {
  // Find conductor track
  let [conductorTracks, normalTracks] = partition(tracks, isConductorTrack)

  // Create a conductor track if there is no conductor track
  if (conductorTracks.length === 0) {
    conductorTracks.push([])
  }

  const [conductorTrack, ...restTracks] = [
    ...conductorTracks,
    ...normalTracks,
  ].map(addTick)

  const newTracks = restTracks.map((track) =>
    track
      .map((e) => {
        // Collect all conductor events
        if (isConductorEvent(e)) {
          conductorTrack.push(e)
          return null
        }
        return e
      })
      .filter(isNotNull),
  )

  return [conductorTrack, ...newTracks].map(addDeltaTime)
}

const getTracks = (midi: MidiFile): Track[] => {
  switch (midi.header.formatType) {
    case 0:
      return tracksFromFormat0Events(midi.tracks[0])
    case 1:
      return createConductorTrackIfNeeded(midi.tracks).map(trackFromMidiEvents)
    default:
      throw new Error(`Unsupported midi format ${midi.header.formatType}`)
  }
}

const applyLights = (event: AnyEvent) => {
  // console.log(event)
}

export function songFromMidi(data: StreamSource) {
  const song = new Song()
  const midi = read(data)

  getTracks(midi).forEach((t) => song.addTrack(t))

  if (midi.header.formatType === 1 && song.tracks.length > 0) {
    // Use the first track name as the song title
    const name = song.tracks[0].name
    if (name !== undefined) {
      song.name = name
    }
  }

  song.timebase = midi.header.ticksPerBeat

  return song
}

const setChannel =
  (channel: number) =>
  (e: AnyEvent): AnyEvent => {
    if (e.type === "channel") {
      return { ...e, channel }
    }
    return e
  }

export function songToMidiEvents(song: Song): AnyEvent[][] {
  const tracks = toJS(song.tracks)
  return tracks.map((t) => {
    const endOfTrack: EndOfTrackEvent = {
      deltaTime: 0,
      type: "meta",
      subtype: "endOfTrack",
    }
    const rawEvents = [...toRawEvents(t.events), endOfTrack]
    if (t.channel !== undefined) {
      return rawEvents.map(setChannel(t.channel))
    }
    return rawEvents
  })
}

export function songToMidi(song: Song) {
  const rawTracks = songToMidiEvents(song)
  return writeMidiFile(rawTracks, song.timebase)
}

export function downloadSongAsMidi(song: Song) {
  const bytes = songToMidi(song)
  songToLights(song)
  const blob = new Blob([bytes], { type: "application/octet-stream" })
  downloadBlob(blob, song.filepath.length > 0 ? song.filepath : "no name.mid")
}

export function songToLights(song: Song) {
  const rawTracks = songToMidiEvents(song);
  let commands = [];
  const tempo = rawTracks[0].filter(e => {
    return "subtype" in e && e.subtype === "setTempo"
  })[0] as SetTempoEvent;

  const bpm = 60_000_000 / tempo.microsecondsPerBeat;
  const sPerTick = 60000 / (bpm * song.timebase) / 1000;

  let currentCommand = createCommand();

  const notes = rectifyEvents(rawTracks);
  for(let i = 0; i < notes.length; i++) {
    let event;
    const note = notes[i]
    let isNoteOn = false;

    if ("subtype" in note && note.subtype == "noteOn") {
      event = note as NoteOnEvent;
      isNoteOn = true;
    } else {
      event = note as NoteOffEvent;
    }

    if(event.deltaTime != 0) {
      if (Object.keys(currentCommand.changes).length === 0) {
        currentCommand.increaseTimeout(event.deltaTime * sPerTick)
      } else {
        commands.push(currentCommand)
        currentCommand = createCommand(event.deltaTime * sPerTick)
      }
    }

    for(let i = 0; i < event.lightChannels.length; i++) {
      currentCommand.setChannel(CHANNELS[event.lightChannels[i]], isNoteOn ? 1 : 0, event.deltaTime, event)
    }

  }

  commands.push(currentCommand);

  let result = []

  for(let i = 0; i < commands.length; i++) {
    result.push({
      "changes": Object.fromEntries(
        Object.entries(commands[i].changes).map(([key, value]) => [key, value.pinValue])
      ),
      "timeout": commands[i].timeout,
      "raw": commands[i].changes
    })
  }

  console.log(result);
}

function rectifyEvents(rawTracks: AnyEvent[][]): AnyEvent[]{
  let allNoteEvents = [];
  for(let i = 0; i < rawTracks.length; i++) {
    const noteEvents = getNoteEvents(rawTracks[i]);
    if (noteEvents.length) {
      allNoteEvents.push(noteEvents);
    }
  }
  
  const times: Times = {};
  for (let i = 0; i < allNoteEvents.length; i ++) {
      times[i] = 0;
  }
  let overallTime = 0
  let isDone = false;
  let result = [];

  while(!isDone) {
    const currentItems: AnyEvent[] = new Array(allNoteEvents.length).fill(null);
    let smallestVal: number | null = null;
    let smallestIndex = -1;

    for (let i = 0; i < allNoteEvents.length; i++) {
      const item = allNoteEvents[i];
      if (item.length > 0) {
        currentItems[i] = item[0];
      }
    }

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (item !== null) {
          const time = item.deltaTime + times[i];
          if (smallestVal === null || (item && time < smallestVal)) {
              smallestVal = time;
              smallestIndex = i;
          }
      }
    }

    if (smallestIndex !== -1) {
      const smallest = allNoteEvents[smallestIndex].shift()!;
      times[smallestIndex] += smallest.deltaTime;
      const deltaTime = times[smallestIndex] - overallTime;
      overallTime += deltaTime;
      smallest.deltaTime = deltaTime;

      if ("subtype" in smallest) {
        if (smallest.subtype == "noteOn" || smallest.subtype == "noteOff") {
          result.push(smallest);
        }
      }
    } else {
        isDone = true;
    }
  }

  return result;
}

function getNoteEvents(events :AnyEvent[]): AnyEvent[] {
  let deltaEvents: AnyEvent[] = [];

  for(let i = 0; i < events.length; i ++) {
    const e = events[i];
    if ("deltaTime" in e) {
      deltaEvents.push(e)
    }
  }

  return deltaEvents;
}
