import { useTheme } from "@emotion/react"
import Color from "color"
import { mat4 } from "gl-matrix"
import { observer } from "mobx-react-lite"
import { VFC } from "react"
import { colorToVec4 } from "../../../gl/color"
import { useStores } from "../../../hooks/useStores"
import { Rectangles } from "../../GLSurface/Rectangles"

export const Notes: VFC<{ projectionMatrix: mat4 }> = observer(
  ({ projectionMatrix }) => {
    const rootStore = useStores()
    const theme = useTheme()
    const { notes } = rootStore.arrangeViewStore

    return (
      <Rectangles
        rects={notes}
        projectionMatrix={projectionMatrix}
        color={colorToVec4(Color(theme.themeColor))}
      />
    )
  }
)
