import { apiClient } from "./apiClient";

function resolveItems(response) {
  return response.data?.data ?? [];
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

    return response.data.data;
  },

  async getDashboard() {
    const response = await this.getMyRequests({
      page_size: 500,
      ordering: "-updated_at",
    });

    return buildDashboard(response.items);
  },

  async createDraft(payload) {
    const response = await apiClient.post(
      "/corrections/requests/",
      payload,
    );

    return response.data.data;
  },

  async updateDraft(id, payload) {
    const response = await apiClient.patch(
      `/corrections/requests/${id}/`,
      payload,
    );

    return response.data.data;
  },

  async deleteDraft(id) {
    const response = await apiClient.delete(
      `/corrections/drafts/${id}/`,
    );

    return response.data.data;
  },

  async submitRequest(id, payload = {}) {
    const response = await apiClient.post(
      `/corrections/requests/${id}/submit/`,
      payload,
    );

    return response.data.data;
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

    return response.data.data;
  },
};
