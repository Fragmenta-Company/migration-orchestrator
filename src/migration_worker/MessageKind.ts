enum MessageKind {
  START = "START",
  RESTART = "RESTART",
  STOP = "STOP",
  PAUSE = "PAUSE",
}

// This other thing defines the type of the data that will be sent to the worker thread
export type MessageData = {
  reason: string;
};

export default MessageKind;
