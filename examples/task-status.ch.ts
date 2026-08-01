// Legacy CH/TS remains a supported source form.
category IterationSnapshot {
  structure TaskRow {
    id: TaskId
    status: TaskStatus
    assignee: PersonId
    estimate: number
  }

  functor statusOf: TaskRow -> TaskStatus

  proposition witness TaskRow.status {
    selector { id: "MOB-1842" }
    value "in_progress"
    path ["tasks", { id: "MOB-1842" }, "status"]
  }
}
