inductive Day where
  | mon | tue | wed | thu | fri | sat | sun
  deriving DecidableEq

def tomorrow : Day → Day
  | Day.mon => Day.tue
  | Day.tue => Day.wed
  | Day.wed => Day.thu
  | Day.thu => Day.fri
  | Day.fri => Day.sat
  | Day.sat => Day.sun
  | Day.sun => Day.mon

def yesterday : Day → Day
  | Day.mon => Day.sun
  | Day.tue => Day.mon
  | Day.wed => Day.tue
  | Day.thu => Day.wed
  | Day.fri => Day.thu
  | Day.sat => Day.fri
  | Day.sun => Day.sat

theorem roundTrip (d : Day) : yesterday (tomorrow d) = d := by
  cases d <;> decide
