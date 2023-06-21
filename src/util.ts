/**
 * Returns the number of pixels to move something at a rate of pixelsPerSecond
 * over a period of delta milliseconds.
 */
export function pixelDiff(pixelsPerSecond: number, deltaMs: number): number {
  return pixelsPerSecond * (deltaMs / 1000);
}

export function randomChoice<T>(list: T[]): T {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

export class StateMachine {
  initialState: string;
  possibleStates: { [key: string]: State };
  stateArgs: any[];
  state: string | null;

  constructor(initialState: string, possibleStates: { [key: string]: State }, stateArgs: any[] = []) {
    this.initialState = initialState;
    this.possibleStates = possibleStates;
    this.stateArgs = stateArgs;
    this.state = null;

    // State instances get access to the state machine via this.stateMachine.
    // This is annoyingly implicit, but the alternative is fucking up a bunch
    // of method signatures that won't otherwise use this.
    // Useful for triggering a transition outside of `execute`.
    for (const state of Object.values(this.possibleStates)) {
      state.stateMachine = this;
      state.init(...this.stateArgs);
    }
  }

  step(...stepArgs: any[]) {
    if (this.state === null) {
      this.state = this.initialState;
      this.possibleStates[this.state].handleEntered(...this.stateArgs);
    }

    // State function returns the state to transition to.
    // Transitions happen instantly rather than next-frame, so we need
    // to loop through until we don't transition.
    while (true) {
      // eslint-disable-line no-constant-condition
      const newState = this.possibleStates[this.state].execute(...this.stateArgs, ...stepArgs);
      if (newState) {
        this.transition(newState);
      } else {
        break;
      }
    }
  }

  transition(newState: string, ...enterArgs: any[]) {
    if (!(newState in this.possibleStates)) {
      throw Error(`Invalid state ${newState}`);
    }

    if (this.state) {
      this.possibleStates[this.state].handleExited(...this.stateArgs);
    }
    this.state = newState;
    this.possibleStates[this.state].handleEntered(...this.stateArgs, ...enterArgs);
  }
}

export class State {
  stateMachine!: StateMachine;

  init(..._args: any[]) {}

  handleEntered(..._args: any[]) {}

  handleExited(..._args: any[]) {}

  execute(..._args: any[]): string | null | undefined | void {
    return null;
  }

  transition(newState: string, ...args: any[]) {
    this.stateMachine.transition(newState, ...args);
  }
}

interface JustDownKey {
  _repeatCounter?: number;
}

export function justDown(key: Phaser.Input.Keyboard.Key & JustDownKey, repeatDelay?: number, repeatRate: number = 100) {
  const justDown = Phaser.Input.Keyboard.JustDown(key);
  if (repeatDelay === undefined) {
    return justDown;
  }

  if (key._repeatCounter === undefined) {
    key._repeatCounter = 0;
  }

  if (!key.isDown) {
    return false;
  }

  const duration = key.getDuration();
  if (justDown || duration < repeatDelay) {
    key._repeatCounter = 0;
    return justDown;
  }

  if (duration > repeatDelay + repeatRate * key._repeatCounter) {
    key._repeatCounter++;
    return true;
  }

  return false;
}
