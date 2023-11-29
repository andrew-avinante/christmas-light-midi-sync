import { observer } from "mobx-react-lite"
import { useCallback } from "react"
import { applylightChannelsToSelection } from "../../actions"
import { useStores } from "../../hooks/useStores"
import { LightsChannelDialog } from "./LightsChannelDialog"

export const PianoRollLightsChannelDialog = observer(() => {
  const rootStore = useStores()
  const { pianoRollStore } = rootStore
  const { openLightsChannelDialog } = pianoRollStore

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
    />
  )
})
