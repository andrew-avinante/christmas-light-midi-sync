import Color from "color"
import { partition } from "lodash"
import { observer } from "mobx-react-lite"
import { FC } from "react"
import { trackColorToCSSColor } from "../../../../common/track/TrackColor"
import { averageColor, colorToVec4 } from "../../../gl/color"
import { useStores } from "../../../hooks/useStores"
import { useTheme } from "../../../hooks/useTheme"
import { PianoNoteItem } from "../../../stores/PianoRollStore"
import { NoteCircles } from "./NoteCircles"
import { NoteRectangles } from "./NoteRectangles"

const CHANNELS = [
  "#57b403",
  "#104fa0",
  "#ecde2c",
  "#91edb1",
  "#a43583",
  "#9309fd",
  "#bf853e",
  "#6fd0e8",
  "#FFBF00",
  "#F5200B"
]

export const Notes: FC<{ zIndex: number }> = observer(({ zIndex }) => {
  const {
    pianoRollStore: { notes, selectedTrack },
  } = useStores()
  const theme = useTheme()

  if (selectedTrack === undefined) {
    return <></>
  }

  const [drumNotes, normalNotes] = partition(notes, (n) => n.isDrum)
  const baseColor = Color(
    selectedTrack.color !== undefined
      ? trackColorToCSSColor(selectedTrack.color)
      : theme.themeColor,
  )
  const borderColor = colorToVec4(baseColor.lighten(0.3))
  const selectedColor = colorToVec4(baseColor.lighten(0.7))
  const backgroundColor = Color(theme.backgroundColor)

  const colorize = (item: PianoNoteItem) => ({
    ...item,
    color: item.isSelected
      ? selectedColor
      : item.lightChannels.length ? averageColor(item.lightChannels.map(index => CHANNELS[index]))
      :
      colorToVec4(baseColor.mix(backgroundColor, 1 - item.velocity / 127)),
  })

  return (
    <>
      <NoteCircles
        strokeColor={borderColor}
        rects={drumNotes.map(colorize)}
        zIndex={zIndex}
      />
      <NoteRectangles
        strokeColor={borderColor}
        rects={normalNotes.map(colorize)}
        zIndex={zIndex + 0.1}
      />
    </>
  )
})
