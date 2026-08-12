import { apiClient } from "./apiClient";

function resolveItems(response) {
  const payload = response.data?.data ?? response.data;

  return Array.isArray(payload) ? payload : [];
}

function resolveItem(response) {
  return response.data?.data ?? response.data ?? null;
}

function resolveMeta(response) {
  return response.data?.meta ?? {};
}

function finalRequestStatus(status) {
  return [
    "CLOSED",
    "CANCELLED",
    "REJECTED",
  ].includes(status);
}

function hoursBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (endDate.getTime() - startDate.getTime()) /
        36_000,
    ) / 100,
  );
}

function buildDashboard(items) {
  const now = Date.now();
  const summary = {
    total: items.length,
    draft: 0,
    pending_approval: 0,
    approved: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    reopened: 0,
    closed: 0,
    sla_overdue: 0,
  };

  const closureHours = [];

  items.forEach((request) => {
    const statusKey =
      request.current_status?.toLowerCase();
    if (
      Object.prototype.hasOwnProperty.call(
        summary,
        statusKey,
      )
    ) {
      summary[statusKey] += 1;
    }

    if (
      request.sla_deadline &&
      !finalRequestStatus(
        request.current_status,
      ) &&
      new Date(request.sla_deadline).getTime() <
        now
    ) {
      summary.sla_overdue += 1;
    }

    if (
      ["RESOLVED", "CLOSED"].includes(
        request.current_status,
      )
    ) {
      const closureTime = hoursBetween(
        request.submitted_at ??
          request.created_at,
        request.updated_at,
      );
      if (closureTime !== null) {
        closureHours.push(closureTime);
      }
    }
  });

  const averageClosureTimeHours =
    closureHours.length > 0
      ? Math.round(
          (closureHours.reduce(
            (sum, value) => sum + value,
            0,
          ) /
            closureHours.length) *
            10,
        ) / 10
      : null;

  return {
    summary,
    average_closure_time_hours:
      averageClosureTimeHours,
    recent_requests: items.slice(0, 8),
  };
}

function incrementMap(map, key) {
  const value = key || "Not specified";
  map.set(value, (map.get(value) ?? 0) + 1);
}

function mapToSeries(map, nameKey) {
  return Array.from(map.entries())
    .map(([name, count]) => ({
      [nameKey]: name,
      count,
    }))
    .sort((first, second) => second.count - first.count);
}

function monthKey(value) {
  if (!value) {
    return "Draft";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function buildAnalytics(items) {
  const voucherMap = new Map();
  const reasonMap = new Map();
  const monthMap = new Map();
  let rejected = 0;
  let reopened = 0;

  items.forEach((request) => {
    incrementMap(
      voucherMap,
      request.voucher_name ||
        request.voucher_code,
    );
    incrementMap(
      reasonMap,
      request.reason_name ||
        request.reason_code,
    );
    incrementMap(
      monthMap,
      monthKey(
        request.submitted_at ??
          request.created_at,
      ),
    );

    if (request.current_status === "REJECTED") {
      rejected += 1;
    }
    if (request.current_status === "REOPENED") {
      reopened += 1;
    }
  });

  const dashboard = buildDashboard(items);
  const total = items.length || 1;

  return {
    requests_by_voucher: mapToSeries(
      voucherMap,
      "voucher",
    ),
    requests_by_reason: mapToSeries(
      reasonMap,
      "reason",
    ),
    monthly_trend: mapToSeries(
      monthMap,
      "month",
    ).reverse(),
    rejection_rate:
      Math.round((rejected / total) * 1000) / 10,
    reopen_rate:
      Math.round((reopened / total) * 1000) / 10,
    average_closure_time_hours:
      dashboard.average_closure_time_hours,
  };
}

export const correctionRequestService = {
  async getRequests(params = {}) {
    const response = await apiClient.get(
      "/corrections/requests/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async getMyRequests(params = {}) {
    const response = await apiClient.get(
      "/corrections/requests/my/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async getRequest(id) {
    const response = await apiClient.get(
      `/corrections/requests/${id}/`,
    );
    const request = resolveItem(response);

    if (!request) {
      throw new Error("Request details were not returned.");
    }

    return request;
  },

  async getDashboard() {
    const response = await this.getMyRequests({
      page_size: 500,
      ordering: "-updated_at",
    });

    return buildDashboard(response.items);
  },

  async getAnalytics() {
    const response = await this.getMyRequests({
      page_size: 500,
      ordering: "-updated_at",
    });

    return buildAnalytics(response.items);
  },

  async createDraft(payload) {
    const response = await apiClient.post(
      "/corrections/requests/",
      payload,
    );

    return resolveItem(response);
  },

  async updateDraft(id, payload) {
    const response = await apiClient.patch(
      `/corrections/requests/${id}/`,
      payload,
    );

    return resolveItem(response);
  },

  async deleteDraft(id) {
    const response = await apiClient.delete(
      `/corrections/drafts/${id}/`,
    );

    return resolveItem(response);
  },

  async cancelRequest(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/cancel/`,
      payload,
    );

    return resolveItem(response);
  },

  async addComment(id, payload) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/comment/`,
      payload,
    );

    return resolveItem(response);
  },

  async confirmResolution(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/confirm-resolution/`,
      payload,
    );

    return resolveItem(response);
  },

  async reopenRequest(id, payload) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/reopen/`,
      payload,
    );

    return resolveItem(response);
  },

  async assignRequest(id, payload) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/assign/`,
      payload,
    );

    return resolveItem(response);
  },

  async reassignRequest(id, payload) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/reassign/`,
      payload,
    );

    return resolveItem(response);
  },

  async getTimeline(request) {
    const response = await apiClient.get(
      "/corrections/timeline/",
      {
        params: {
          request,
          page_size: 200,
          ordering: "created_at",
        },
      },
    );

    return resolveItems(response);
  },

  async getAttachments(request) {
    const response = await apiClient.get(
      "/corrections/attachments/",
      {
        params: {
          request,
          page_size: 100,
        },
      },
    );

    return resolveItems(response);
  },

  async submitRequest(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/submit/`,
      payload,
    );

    return resolveItem(response);
  },

  async uploadAttachment({
    request,
    file,
    attachment_type = "SUPPORTING_DOCUMENT",
  }) {
    const formData = new FormData();
    formData.append("request", request);
    formData.append("file", file);
    formData.append(
      "attachment_type",
      attachment_type,
    );

    const response = await apiClient.post(
      "/corrections/attachments/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return resolveItem(response);
  },

  async getApprovalInbox(params = {}) {
    const response = await apiClient.get(
      "/corrections/approvals/inbox/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async getApprovalSteps(params = {}) {
    const response = await apiClient.get(
      "/corrections/approvals/",
      {
        params,
      },
    );

    return {
      items: resolveItems(response),
      meta: resolveMeta(response),
    };
  },

  async getApprovalStep(id) {
    const response = await apiClient.get(
      `/corrections/approvals/${id}/`,
    );
    const step = resolveItem(response);

    if (!step) {
      throw new Error("Approval details were not returned.");
    }

    return step;
  },

  async getApprovalHistory(id) {
    const response = await apiClient.get(
      `/corrections/approvals/${id}/history/`,
    );

    return resolveItems(response);
  },

  async getApprovalPendingCounts() {
    const response = await apiClient.get(
      "/corrections/approvals/pending-counts/",
    );

    return resolveItem(response) ?? {};
  },

  async approveApprovalStep(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/approvals/${id}/approve/`,
      payload,
    );

    return resolveItem(response);
  },

  async rejectApprovalStep(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/approvals/${id}/reject/`,
      payload,
    );

    return resolveItem(response);
  },

  async returnApprovalStep(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/approvals/${id}/return/`,
      payload,
    );

    return resolveItem(response);
  },

  async commentApprovalStep(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/approvals/${id}/comment/`,
      payload,
    );

    return resolveItem(response);
  },

  async delegateApprovalStep(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/approvals/${id}/delegate/`,
      payload,
    );

    return resolveItem(response);
  },
};
