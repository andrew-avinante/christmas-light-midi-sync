import isEqual from "lodash/isEqual"
import omit from "lodash/omit"
import sortBy from "lodash/sortBy"
import {
  ControllerEvent,
  ProgramChangeEvent,
  SetTempoEvent,
  TrackNameEvent,
} from "midifile-ts"
import { action, computed, makeObservable, observable, transaction } from "mobx"
import { createModelSchema, list, primitive } from "serializr"
import { bpmToUSecPerBeat } from "../helpers/bpm"
import { pojo } from "../helpers/pojo"
import {
  programChangeMidiEvent,
  setTempoMidiEvent,
  trackNameMidiEvent,
} from "../midi/MidiEvent"
import { TrackColor } from "./TrackColor"
import { TrackEvent, TrackEventOf } from "./TrackEvent"
import { isControllerEventWithType, isNoteEvent } from "./identify"
import {
  getLast,
  getPan,
  getProgramNumberEvent,
  getTempo,
  getTempoEvent,
  getTimeSignatureEvent,
  getTrackNameEvent,
  getVolume,
  isTickBefore,
} from "./selector"
import { SignalTrackColorEvent, isSignalTrackColorEvent } from "./signalEvents"
import { validateMidiEvent } from "./validate"

export default class Track {
  events: TrackEvent[] = []
  channel: number | undefined = undefined

  private lastEventId = 0
  private lastGroupId = 0

  getEventById = (id: number): TrackEvent | undefined =>
    this.events.find((e) => e.id === id)

  getNewGroupId = (): number => {
    return this.lastGroupId++
  }

  getGroupByGroupId = (groupId: number): TrackEvent[] => {
    let result: TrackEvent[] = [];
    for(let i = 0; i < this.events.length; i ++) {
      const e = this.events[i]
      if("groupId" in e) {
        if (e !== undefined && e.groupId == groupId) {
          result.push(e)
        }
      }
    }

    return result;
  }

  // getEventByAttributes = (ticks: number, note: number, channel: number): TrackEvent | undefined => {
  //   this.events.find((e) => {
  //     if("subtype" in e && e.subtype == "note") {
  //       e.tick
  //     }
  //   });
  // }

  applyGroup = (groupId: number): TrackEvent[][] => {
    const group = this.getGroupByGroupId(groupId);
    const matches: TrackEvent[][] = [];
    let currentMatch: TrackEvent[] = [];
    let distances = [];
    let groupIndex = 0;

    for(let i = 1; i < group.length; i++) {
      const current = group[i]
      const previous = group[i - 1]
      if("subtype" in current && current.subtype == "note" && "subtype" in previous && previous.subtype == "note") {
        distances.push(current.tick - previous.tick)
      }
    }

    for(let i = 0; i < this.events.length; i++) {
      if(groupIndex === group.length) {
        matches.push(currentMatch);
        currentMatch = [];
        groupIndex = 0;
      } 

      const e = this.events[i];
      const g = group[groupIndex];

      if(e == undefined) {
        continue;
      }
      
        if("subtype" in e && e.subtype == "note" && "subtype" in g && g.subtype == "note") {
          const upperDurationTolerance = g.duration * 1.25
          const lowerDurationTolerance = g.duration * 0.75
          console.log(lowerDurationTolerance, e.duration, upperDurationTolerance)
          if (groupIndex < group.length && g.noteNumber == e.noteNumber && lowerDurationTolerance <= e.duration && e.duration <= upperDurationTolerance) {
            if(groupIndex == 0) {
              currentMatch.push(e)
              groupIndex++;
            } else {
              const previous = currentMatch[groupIndex - 1]
              const lowerTolerance = distances[groupIndex - 1] - 100
              const upperTolerance = distances[groupIndex - 1] + 100
              console.log(lowerTolerance, e.tick - previous.tick, upperTolerance)
              if("subtype" in previous && previous.subtype == "note" && lowerTolerance <= e.tick - previous.tick && e.tick - previous.tick <= upperTolerance) {
                currentMatch.push(e)
                groupIndex++
              } else {
                groupIndex = 0;
                currentMatch = [];
              }
            }
          }
        }
      }

    if(currentMatch.length === group.length) {
      matches.push(currentMatch);
    }

    return matches;
  }

  constructor() {
    makeObservable(this, {
      updateEvent: action,
      updateEvents: action,
      removeEvent: action,
      removeEvents: action,
      addEvent: action,
      addEvents: action,
      sortByTick: action,
      name: computed,
      endOfTrack: computed,
      programNumber: computed,
      isConductorTrack: computed,
      isRhythmTrack: computed,
      color: computed,
      events: observable.shallow,
      channel: observable,
    })
  }

  private _updateEvent<T extends TrackEvent>(
    id: number,
    obj: Partial<T>,
  ): T | null {
    const index = this.events.findIndex((e) => e.id === id)
    if (index < 0) {
      console.warn(`unknown id: ${id}`)
      return null
    }
    const anObj = this.events[index] as T
    const newObj = { ...anObj, ...obj }
    if (isEqual(newObj, anObj)) {
      return null
    }
    this.events[index] = newObj

    if (process.env.NODE_ENV !== "production") {
      validateMidiEvent(newObj)
    }

    return newObj
  }

  updateEvent<T extends TrackEvent>(id: number, obj: Partial<T>): T | null {
    const result = this._updateEvent(id, obj)
    if (result) {
      this.sortByTick()
    }
    return result
  }

  loadLightChannels<T extends TrackEvent>(events: Partial<T>[]) {
    transaction(() => {
      events.forEach((event) => {
        if (event.id === undefined) {
          return
        }
        this._updateEvent(event.id, event)
      })
    })
    this.sortByTick()
  }

  updateEvents<T extends TrackEvent>(events: Partial<T>[]) {
    transaction(() => {
      events.forEach((event) => {
        if (event.id === undefined) {
          return
        }
        this._updateEvent(event.id, event)
      })
    })
    this.sortByTick()
  }

  removeEvent(id: number) {
    this.removeEvents([id])
  }

  removeEvents(ids: number[]) {
    this.events = this.events.filter((e) => !ids.includes(e.id))
  }

  // ソート、通知を行わない内部用の addEvent
  // add the event without sorting, notification
  private _addEvent<T extends TrackEvent>(
    e: Omit<T, "id"> & { subtype?: string },
  ): T {
    if (!("tick" in e) || isNaN(e.tick)) {
      throw new Error("invalid event is added")
    }
    if ("subtype" in e && e.subtype === "endOfTrack") {
      throw new Error("endOfTrack event is added")
    }
    const newEvent = {
      ...omit(e, ["deltaTime", "channel"]),
      id: this.lastEventId++,
    } as T
    this.events.push(newEvent)
    return newEvent
  }

  addEvent<T extends TrackEvent>(e: Omit<T, "id">): T {
    const ev = this._addEvent(e)
    this.didAddEvent()
    return ev
  }

  addEvents<T extends TrackEvent>(events: Omit<T, "id">[]): T[] {
    const result = transaction(() => {
      const dontMoveChannelEvent = this.isConductorTrack

      return events
        .filter((e) => (dontMoveChannelEvent ? e.type !== "channel" : true))
        .map((e) => this._addEvent(e))
    })
    this.didAddEvent()
    return result
  }

  didAddEvent() {
    this.sortByTick()
  }

  sortByTick() {
    this.events = sortBy(this.events, "tick")
  }

  transaction<T>(func: (track: Track) => T) {
    return transaction(() => func(this))
  }

  /* helper */

  private getRedundantEvents<T extends TrackEvent>(
    event: Omit<T, "id"> & { subtype?: string; controllerType?: number },
  ) {
    return this.events.filter(
      (e) =>
        e.type === event.type &&
        e.tick === event.tick &&
        ("subtype" in e && "subtype" in event
          ? e.subtype === event.subtype
          : true) &&
        ("controllerType" in e && "controllerType" in event
          ? e.controllerType === event.controllerType
          : true),
    )
  }

  createOrUpdate<T extends TrackEvent>(
    newEvent: Omit<T, "id"> & { subtype?: string; controllerType?: number },
  ): T {
    const events = this.getRedundantEvents(newEvent)

    if (events.length > 0) {
      this.transaction((it) => {
        events.forEach((e) => {
          it.updateEvent(e.id, { ...newEvent, id: e.id } as Partial<T>)
        })
      })
      return events[0] as T
    } else {
      return this.addEvent(newEvent)
    }
  }

  removeRedundantEvents<T extends TrackEvent>(
    event: T & { subtype?: string; controllerType?: number },
  ) {
    this.removeEvents(
      this.getRedundantEvents(event)
        .filter((e) => e.id !== event.id)
        .map((e) => e.id),
    )
  }

  private setControllerValue = (
    controllerType: number,
    tick: number,
    value: number,
  ) => {
    const e = getLast(
      this.events
        .filter(isControllerEventWithType(controllerType))
        .filter(isTickBefore(tick)),
    )
    if (e !== undefined) {
      this.updateEvent<TrackEventOf<ControllerEvent>>(e.id, {
        value,
      })
    } else {
      // If there are no controller events, we insert new event at the head of the track
      this.addEvent<TrackEventOf<ControllerEvent>>({
        type: "channel",
        subtype: "controller",
        controllerType,
        tick: 0,
        value,
      })
    }
  }

  get name() {
    return getTrackNameEvent(this.events)?.text
  }
  get programNumber() {
    return getProgramNumberEvent(this.events)?.value
  }
  get endOfTrack() {
    let maxTick = 0
    // Use for loop instead of map/filter to avoid the error `Maximum call stack size exceeded`
    for (const e of this.events) {
      const tick = isNoteEvent(e) ? e.tick + e.duration : e.tick
      maxTick = Math.max(maxTick, tick)
    }
    return maxTick
  }

  get color(): SignalTrackColorEvent | undefined {
    return this.events.filter(isSignalTrackColorEvent)[0]
  }

  setColor(color: TrackColor | null) {
    if (color === null) {
      const e = this.color
      if (e !== undefined) {
        this.removeEvent(e.id)
      }
      return
    }
    const e = this.color
    if (e !== undefined) {
      this.updateEvent<SignalTrackColorEvent>(e.id, color)
    } else {
      this.addEvent<TrackEventOf<SignalTrackColorEvent>>({
        tick: 0,
        type: "channel",
        subtype: "signal",
        signalEventType: "trackColor",
        ...color,
      })
    }
  }

  getPan = (tick: number) => getPan(this.events, tick)
  getVolume = (tick: number) => getVolume(this.events, tick)
  getTempo = (tick: number) => getTempo(this.events, tick)
  getTimeSignatureEvent = (tick: number) =>
    getTimeSignatureEvent(this.events, tick)

  setVolume = (value: number, tick: number) =>
    this.setControllerValue(7, tick, value)

  setPan = (value: number, tick: number) =>
    this.setControllerValue(10, tick, value)

  setProgramNumber(value: number) {
    const e = getProgramNumberEvent(this.events)
    if (e !== undefined) {
      this.updateEvent<TrackEventOf<ProgramChangeEvent>>(e.id, { value })
    } else {
      this.addEvent<TrackEventOf<ProgramChangeEvent>>({
        ...programChangeMidiEvent(0, 0, value),
        tick: 0,
      })
    }
  }

  setTempo(bpm: number, tick: number) {
    const e = getTempoEvent(this.events, tick)
    const microsecondsPerBeat = Math.floor(bpmToUSecPerBeat(bpm))
    if (e !== undefined) {
      this.updateEvent<TrackEventOf<SetTempoEvent>>(e.id, {
        microsecondsPerBeat,
      })
    } else {
      this.addEvent<TrackEventOf<SetTempoEvent>>({
        ...setTempoMidiEvent(0, microsecondsPerBeat),
        tick: 0,
      })
    }
  }

  setName(text: string) {
    const e = getTrackNameEvent(this.events)
    if (e !== undefined) {
      this.updateEvent<TrackEventOf<TrackNameEvent>>(e.id, { text })
    } else {
      this.addEvent<TrackEventOf<TrackNameEvent>>({
        ...trackNameMidiEvent(0, text),
        tick: 0,
      })
    }
  }

  get isConductorTrack() {
    return this.channel === undefined
  }

  get isRhythmTrack() {
    return this.channel === 9
  }

  clone() {
    const track = new Track()
    track.channel = this.channel
    track.addEvents(this.events.map((e) => ({ ...e })))
    return track
  }
}

createModelSchema(Track, {
  events: list(pojo),
  lastEventId: primitive(),
  channel: primitive(),
})
