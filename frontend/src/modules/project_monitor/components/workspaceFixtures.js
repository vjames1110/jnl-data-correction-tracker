// Minimal activity sheets shaped like the API's ``groups`` payload.
export function row(id, name, status = "NOT_STARTED", extra = {}) {
  return {
    id,
    name,
    status,
    kind: "TASK",
    done_qty: "0",
    total_qty: "0",
    unit: "",
    is_doc: false,
    date_history: [],
    comments: [],
    ...extra,
  };
}

export const GROUPS = [
  {
    group_order: 0,
    group_title: "Approvals",
    group_subtitle: "",
    rows: [
      row("a1", "GAD Approval", "COMPLETE", { is_doc: true }),
      row("a2", "Structural drawing approval", "NOT_STARTED", {
        is_doc: true,
      }),
    ],
  },
  {
    group_order: 1,
    group_title: "Box Structure",
    group_subtitle: "Barrel and slabs",
    rows: [
      row("b1", "Excavation", "COMPLETE"),
      row("b2", "Bottom slab", "IN_PROGRESS"),
      row("b3", "Apron", "NOT_APPLICABLE"),
    ],
  },
  {
    group_order: 2,
    group_title: "Wing walls",
    group_subtitle: "",
    rows: [row("w1", "Return wall 1", "NOT_STARTED")],
  },
];

export const STRUCTURE = {
  id: "s1",
  name: "Br. No. 214",
  description: "1 cell box, 12 m barrel",
  chainage_km: "12.345",
  overall_progress: { done: 2, total: 6 },
  groups: GROUPS,
};

export function handlers(overrides = {}) {
  return {
    activeActivityId: null,
    onSelectActivity: () => {},
    canEdit: true,
    onSubmitUpdate: () => {},
    updateStatus: { isPending: false, isError: false },
    onReviewActivity: () => {},
    reviewActivityStatus: { isPending: false, isError: false },
    ...overrides,
  };
}
