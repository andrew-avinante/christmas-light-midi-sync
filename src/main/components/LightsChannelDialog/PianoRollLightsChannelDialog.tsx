import { observer } from "mobx-react-lite"
import { useCallback } from "react"
import { isNoteEvent } from "../../../common/track"
import { applylightChannelsToSelection } from "../../actions"
import { useStores } from "../../hooks/useStores"
import { LightsChannelDialog } from "./LightsChannelDialog"

export const PianoRollLightsChannelDialog = observer(() => {
  const rootStore = useStores()
  const { pianoRollStore, song } = rootStore
  const { openLightsChannelDialog } = pianoRollStore
  const {  selectedTrackId, selectedNoteIds } = pianoRollStore
  const selectedEventIds =  {
    [selectedTrackId]: selectedNoteIds,
  }
  let selectedChannels: number[] = []

  for (const trackIdStr in selectedEventIds) {
    const trackId = parseInt(trackIdStr)
    const eventIds = selectedEventIds[trackId]
    const track = song.getTrack(trackId)
    if (track === undefined) {
      continue
    }

    const channels = eventIds
    .map((id) => {
      const n = track.getEventById(id)

      if (n == undefined || !isNoteEvent(n)) {
        return []
      }
      console.log(n);
      return n.lightChannels
    });

    for(let i = 0; i < channels.length; i++ ) {
      for(let j = 0; j < channels[i]?.length; j++) {
        const channel = channels[i][j];

        selectedChannels.push(channel)
      }
    }
  }

  const onClose = useCallback(
    () => (pianoRollStore.openLightsChannelDialog = false),
    [pianoRollStore],
  )

  const onClickOK = useCallback(
    (value: number[]) => {
      applylightChannelsToSelection(rootStore)(value)
      pianoRollStore.openLightsChannelDialog = false
    },
    [pianoRollStore],
  )

  return (
    <LightsChannelDialog
      open={openLightsChannelDialog}
      onClose={onClose}
      onClickOK={onClickOK}
      selectedChannels={selectedChannels}
    />
  )
})
