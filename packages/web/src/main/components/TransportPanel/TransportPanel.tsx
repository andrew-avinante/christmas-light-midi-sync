import {
  Toolbar,
  ToolbarItem,
  ToolbarSeparator
} from "components/groups/Toolbar"
import Icon from "components/outputs/Icon"
import React, { StatelessComponent } from "react"
import "./TransportPanel.css"

export interface TransportPanelProps {
  onClickPlay: () => void
  onClickStop: () => void
  onClickBackward: () => void
  onClickForward: () => void
  loopEnabled: boolean
  onClickEnableLoop: () => void
  mbtTime: string
  tempo: number
  onClickTempo: () => void
}

export const TransportPanel: StatelessComponent<TransportPanelProps> = ({
  onClickPlay,
  onClickStop,
  onClickBackward,
  onClickForward,
  loopEnabled,
  onClickEnableLoop,
  mbtTime,
  tempo = 0,
  onClickTempo
}) => {
  return (
    <Toolbar className="TransportPanel">
      <ToolbarSeparator />

      <ToolbarItem onClick={onClickBackward}>
        <Icon>skip-backward</Icon>
      </ToolbarItem>
      <ToolbarItem onClick={onClickStop}>
        <Icon>stop</Icon>
      </ToolbarItem>
      <ToolbarItem onClick={onClickPlay}>
        <Icon>play</Icon>
      </ToolbarItem>
      <ToolbarItem onClick={onClickForward}>
        <Icon>skip-forward</Icon>
      </ToolbarItem>
      <ToolbarItem onClick={onClickEnableLoop} selected={loopEnabled}>
        <Icon>loop</Icon>
      </ToolbarItem>

      <ToolbarSeparator />

      <ToolbarItem className="tempo-section" onClick={onClickTempo}>
        <p className="tempo">{tempo.toFixed(2)}</p>
      </ToolbarItem>

      <ToolbarSeparator />

      <ToolbarItem className="time-section">
        <p className="time">{mbtTime}</p>
      </ToolbarItem>
    </Toolbar>
  )
}
