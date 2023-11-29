import { AnyEvent } from "midifile-ts";

export interface Command {
  timeout: number;
  changes: Record<string, any>;
  setChannel(channelId: string, pinValue: any, ticks: number, event: AnyEvent): boolean;
  increaseTimeout(t: number): void;
}

export const createCommand = (
  preTimeout: number = 0,
  changes: Record<string, number> | null = null
): Command => ({
  timeout: preTimeout,
  changes: changes || {},

  setChannel(channelId: string, pinValue: number, ticks: number, event: AnyEvent): boolean {
    this.changes[channelId] = 
    {
      pinValue,
      ticks,
      event
    };
    return channelId in this.changes && this.changes[channelId] === pinValue;
  },

  increaseTimeout(t: number): void {
    this.timeout += t;
  },
});
