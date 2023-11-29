import { FC, useState } from "react"
import { Button, PrimaryButton } from "../../../components/Button"
import { Checkbox } from "../../../components/Checkbox"
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "../../../components/Dialog"
import { Localized } from "../../../components/Localized"

export interface LightsChannelDialogProps {
  open: boolean
  onClickOK: (value: number[]) => void
  onClose: () => void
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

export const LightsChannelDialog: FC<LightsChannelDialogProps> = ({
  open,
  onClickOK,
  onClose,
}) => {
  const [channels, setChannels] = useState(Object.fromEntries(
    CHANNELS.map(key => [key, false])
  ))

  // reset on open
  // useEffect(() => {
  //   if (open) {
  //     setInput("")
  //   }
  // }, [open])

  const _onClickOK = () => {
    let resultArray: number[] = []

    Object.entries(channels).forEach(([_, value], index) => {
      if(value) {
        resultArray.push(index)
      }
    });

    onClickOK(resultArray)
    onClose()
  }

  const onCheck = (key: string) => {
    const newChannelVals = { ...channels };
    newChannelVals[key] = !channels[key];
    setChannels(newChannelVals);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle>
        <Localized default="Lights Channel">lights</Localized>
      </DialogTitle>
      <DialogContent>
        {
          Object.entries(channels).map(([key, _]) => (
          <Checkbox
            checked={channels[key]}
            onCheckedChange={() => onCheck(key)}
            label={key}
          />
          ))
        }
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          <Localized default="Close">close</Localized>
        </Button>
        <PrimaryButton onClick={_onClickOK}>
          <Localized default="OK">ok</Localized>
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  )
}
