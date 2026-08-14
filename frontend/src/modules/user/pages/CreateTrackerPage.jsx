import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  Paperclip,
  Save,
  Send,
  Upload,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SearchableSelect } from "../../../components/common/SearchableSelect";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCreateCorrectionDraft,
  useCorrectionDashboard,
  useCorrectionRequest,
  useSubmitCorrectionRequest,
  useUpdateCorrectionDraft,
  useUploadCorrectionAttachment,
} from "../../../hooks/useCorrectionRequests";
import { useEmployeeDropdown } from "../../../hooks/useEmployees";
import {
  useDepartmentsDropdown,
  useSites,
  useSitesDropdown,
} from "../../../hooks/useOrganization";
import {
  useErpModulesDropdown,
  useErpPriorities,
  useErpRequestFieldConfigurations,
  useErpReasonCategoriesDropdown,
  useErpVoucherTypes,
  useErpWorkTypes,
} from "../../../hooks/useErp";
import { useAuth } from "../../../hooks/useAuth";

const emptyForm = {
  site: "",
  department: "",
  erp_module: "",
  voucher_type: "",
  work_type: "",
  voucher_number: "",
  voucher_date: "",
  erp_email_date: "",
  ho_work_authority: "",
  site_work_authority: "",
  root_cause_person: "",
  reason_category: "",
  priority: "",
  description: "",
  requested_window_start: "",
  requested_window_end: "",
  amount: "",
  quantity: "",
};

const fieldAliases = {
  voucher_number: [
    "VOUCHER_NUMBER",
    "VOUCHERNUMBER",
  ],
  voucher_date: [
    "VOUCHER_DATE",
    "VOUCHERDATE",
  ],
  erp_email_date: [
    "ERP_EMAIL_DATE",
    "ERPEMAILDATE",
    "EMAIL_DATE",
  ],
  requested_window_start: [
    "REQUESTED_WINDOW_START",
    "REQUESTEDWINDOWSTART",
    "WINDOW_START",
  ],
  requested_window_end: [
    "REQUESTED_WINDOW_END",
    "REQUESTEDWINDOWEND",
    "WINDOW_END",
  ],
  amount: ["AMOUNT", "AFFECTED_AMOUNT"],
  quantity: [
    "QUANTITY",
    "AFFECTED_QUANTITY",
  ],
  description: ["DESCRIPTION", "REMARKS"],
};

const baseValidationFields = [
  ["site", "Site", "REQUIRED"],
  ["department", "Department", "REQUIRED"],
  ["erp_module", "ERP Module", "REQUIRED"],
  ["voucher_type", "Voucher Type", "REQUIRED"],
  ["work_type", "Correction Type", "REQUIRED"],
  ["erp_email_date", "ERP Email Date", "REQUIRED"],
  ["reason_category", "Reason", "REQUIRED"],
  ["priority", "Priority", "REQUIRED"],
  ["description", "Description", "REQUIRED"],
];

function normalizePayload(form) {
  return {
    ...form,
    site: form.site || null,
    department: form.department || null,
    erp_module: form.erp_module || null,
    voucher_type: form.voucher_type || null,
    work_type: form.work_type || null,
    reason_category:
      form.reason_category || null,
    priority: form.priority || null,
    voucher_date: form.voucher_date || null,
    erp_email_date:
      form.erp_email_date || null,
    ho_work_authority:
      form.ho_work_authority || null,
    site_work_authority:
      form.site_work_authority || null,
    root_cause_person:
      form.root_cause_person || null,
    requested_window_start:
      form.requested_window_start || null,
    requested_window_end:
      form.requested_window_end || null,
    amount: form.amount || null,
    quantity: form.quantity || null,
  };
}

function selectLabel(items, id) {
  const item = items.find(
    (current) => current.id === id,
  );

  if (!item) {
    return "-";
  }

  return item.code
    ? `${item.code} - ${item.label}`
    : item.label;
}

function toPersonOptions(employees) {
  return (employees ?? []).map((employee) => ({
    value: employee.id,
    label: employee.label,
  }));
}

function errorMessage(error) {
  return (
    error?.message ??
    "Unable to complete the request."
  );
}

function toFormData(request) {
  return Object.fromEntries(
    Object.keys(emptyForm).map((field) => [
      field,
      request?.[field] ?? "",
    ]),
  );
}

function normalizeFieldKey(value) {
  return String(value ?? "")
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, "");
}

function matchesScope(config, form) {
  return [
    ["erp_module", form.erp_module],
    ["voucher_type", form.voucher_type],
    ["work_type", form.work_type],
    ["priority", form.priority],
  ].every(([field, value]) => {
    if (!config[field]) {
      return true;
    }
    return !value || config[field] === value;
  });
}

function specificity(config) {
  return [
    "erp_module",
    "voucher_type",
    "work_type",
    "priority",
  ].filter((field) => config[field]).length;
}

export function CreateTrackerPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { user } = useAuth();
  const formKey = requestId ?? "new";
  const [formState, setFormState] =
    useState({
      key: "new",
      values: {},
    });
  const [attachmentFile, setAttachmentFile] =
    useState(null);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [localError, setLocalError] =
    useState("");
  const [duplicateState, setDuplicateState] =
    useState(null);
  const [overrideReason, setOverrideReason] =
    useState("");

  const sitesQuery = useSitesDropdown();
  const sitesDetailQuery = useSites({
    is_active: true,
    page_size: 500,
  });
  const departmentsQuery =
    useDepartmentsDropdown();
  const modulesQuery =
    useErpModulesDropdown();
  const voucherTypesQuery = useErpVoucherTypes({
    page_size: 500,
    is_active: true,
  });
  const workTypesQuery = useErpWorkTypes({
    page_size: 500,
    is_active: true,
  });
  const reasonsQuery =
    useErpReasonCategoriesDropdown();
  const prioritiesQuery = useErpPriorities({
    page_size: 500,
    is_active: true,
  });
  const fieldConfigurationsQuery =
    useErpRequestFieldConfigurations({
      page_size: 500,
      is_active: true,
    });
  const dashboardQuery = useCorrectionDashboard();
  const draftQuery =
    useCorrectionRequest(requestId);

  const loadedForm = useMemo(
    () =>
      requestId && draftQuery.data
        ? toFormData(draftQuery.data)
        : emptyForm,
    [draftQuery.data, requestId],
  );
  const form = useMemo(
    () => ({
      ...loadedForm,
      ...(formState.key === formKey
        ? formState.values
        : {}),
    }),
    [formKey, formState, loadedForm],
  );

  const employeesQuery = useEmployeeDropdown(
    form.site
      ? { site: form.site }
      : undefined,
  );

  const hoSite = useMemo(
    () =>
      (
        sitesDetailQuery.data?.items ?? []
      ).find(
        (site) => site.site_code === "HO",
      ) ?? null,
    [sitesDetailQuery.data],
  );
  const hoEmployeesQuery = useEmployeeDropdown(
    hoSite ? { site: hoSite.id } : undefined,
  );
  const siteAuthorityEmployeesQuery =
    useEmployeeDropdown(
      form.site && form.department
        ? {
            site: form.site,
            department: form.department,
          }
        : undefined,
    );

  const rootCausePersonOptions = useMemo(
    () =>
      toPersonOptions(employeesQuery.data),
    [employeesQuery.data],
  );
  const hoWorkAuthorityOptions = useMemo(
    () =>
      toPersonOptions(hoEmployeesQuery.data),
    [hoEmployeesQuery.data],
  );
  const siteWorkAuthorityOptions = useMemo(
    () =>
      toPersonOptions(
        siteAuthorityEmployeesQuery.data,
      ),
    [siteAuthorityEmployeesQuery.data],
  );

  const createDraft = useCreateCorrectionDraft();
  const updateDraft = useUpdateCorrectionDraft();
  const submitRequest =
    useSubmitCorrectionRequest();
  const uploadAttachment =
    useUploadCorrectionAttachment();

  const voucherTypes = useMemo(
    () => voucherTypesQuery.data?.items ?? [],
    [voucherTypesQuery.data],
  );
  const workTypes = useMemo(
    () => workTypesQuery.data?.items ?? [],
    [workTypesQuery.data],
  );
  const priorities = useMemo(
    () => prioritiesQuery.data?.items ?? [],
    [prioritiesQuery.data],
  );
  const fieldConfigurations = useMemo(
    () =>
      fieldConfigurationsQuery.data?.items ?? [],
    [fieldConfigurationsQuery.data],
  );

  const selectedVoucher = voucherTypes.find(
    (voucher) => voucher.id === form.voucher_type,
  );
  const selectedPriority = priorities.find(
    (priority) => priority.id === form.priority,
  );
  const selectedWorkType = workTypes.find(
    (workType) => workType.id === form.work_type,
  );

  const filteredVouchers = useMemo(
    () =>
      voucherTypes.filter((voucher) => {
        if (
          form.erp_module &&
          voucher.erp_module !== form.erp_module
        ) {
          return false;
        }
        if (
          form.department &&
          voucher.department &&
          voucher.department !== form.department
        ) {
          return false;
        }
        return true;
      }),
    [
      form.department,
      form.erp_module,
      voucherTypes,
    ],
  );

  const dynamicFieldStates = useMemo(() => {
    const result = {};

    Object.entries(fieldAliases).forEach(
      ([field, aliases]) => {
        const normalizedAliases = aliases.map(
          normalizeFieldKey,
        );
        const matchingConfigs =
          fieldConfigurations
            .filter(
              (config) =>
                config.is_active &&
                normalizedAliases.includes(
                  normalizeFieldKey(
                    config.field_key,
                  ),
                ) &&
                matchesScope(config, form),
            )
            .sort(
              (first, second) =>
                specificity(second) -
                  specificity(first) ||
                (first.display_order ?? 0) -
                  (second.display_order ?? 0),
            );

        if (matchingConfigs.length) {
          result[field] = matchingConfigs[0];
        }
      },
    );

    return result;
  }, [fieldConfigurations, form]);

  const fieldState = useCallback(
    (field, fallback) =>
      dynamicFieldStates[field]?.field_state ??
      fallback,
    [dynamicFieldStates],
  );

  const isFieldHidden = useCallback(
    (field, fallback) =>
      fieldState(field, fallback) === "HIDDEN",
    [fieldState],
  );

  const isFieldRequired = useCallback(
    (field, fallback) =>
      fieldState(field, fallback) === "REQUIRED",
    [fieldState],
  );

  const amountState =
    selectedVoucher?.requires_amount
      ? "REQUIRED"
      : "OPTIONAL";
  const quantityState =
    selectedVoucher?.requires_quantity
      ? "REQUIRED"
      : "OPTIONAL";

  const validationItems = useMemo(() => {
    const fields = [
      ...baseValidationFields,
      [
        "voucher_number",
        "Voucher Number",
        selectedVoucher?.requires_voucher_number
          ? "REQUIRED"
          : "OPTIONAL",
      ],
      [
        "voucher_date",
        "Voucher Date",
        selectedVoucher?.requires_voucher_date
          ? "REQUIRED"
          : "OPTIONAL",
      ],
    ];

    if (!isFieldHidden("amount", amountState)) {
      fields.push([
        "amount",
        "Affected Amount",
        amountState,
      ]);
    }
    if (!isFieldHidden("quantity", quantityState)) {
      fields.push([
        "quantity",
        "Affected Quantity",
        quantityState,
      ]);
    }

    return fields
      .filter(
        ([field, , fallback]) =>
          !isFieldHidden(field, fallback) &&
          isFieldRequired(field, fallback),
      )
      .map(([field, label]) => ({
        field,
        label,
        complete: Boolean(form[field]),
      }));
  }, [
    amountState,
    form,
    isFieldHidden,
    isFieldRequired,
    quantityState,
    selectedVoucher,
  ]);

  const missingRequiredCount =
    validationItems.filter(
      (item) => !item.complete,
    ).length;

  const isLoadingMasters =
    sitesQuery.isLoading ||
    departmentsQuery.isLoading ||
    modulesQuery.isLoading ||
    voucherTypesQuery.isLoading ||
    workTypesQuery.isLoading ||
    reasonsQuery.isLoading ||
    prioritiesQuery.isLoading ||
    fieldConfigurationsQuery.isLoading ||
    draftQuery.isLoading;

  const masterError =
    sitesQuery.error ??
    departmentsQuery.error ??
    modulesQuery.error ??
    voucherTypesQuery.error ??
    workTypesQuery.error ??
    reasonsQuery.error ??
    prioritiesQuery.error ??
    fieldConfigurationsQuery.error ??
    draftQuery.error;

  const isSubmitting =
    createDraft.isPending ||
    updateDraft.isPending ||
    submitRequest.isPending ||
    uploadAttachment.isPending;
  const actionError =
    createDraft.error ??
    updateDraft.error ??
    submitRequest.error ??
    uploadAttachment.error;

  const setField = (field, value) => {
    setSuccessMessage("");
    setLocalError("");
    setDuplicateState(null);
    setFormState((current) => {
      const currentValues =
        current.key === formKey
          ? current.values
          : {};

      return {
        key: formKey,
        values: {
          ...currentValues,
          [field]: value,
          ...(field === "erp_module" ||
          field === "department"
            ? { voucher_type: "" }
            : {}),
        },
      };
    });
  };

  async function uploadIfNeeded(requestId) {
    if (!attachmentFile) {
      return;
    }

    await uploadAttachment.mutateAsync({
      request: requestId,
      file: attachmentFile,
      attachment_type:
        attachmentFile.type?.startsWith("image/")
          ? "EMAIL_SCREENSHOT"
          : "SUPPORTING_DOCUMENT",
    });
  }

  async function handleSave({ submitNow }) {
    setSuccessMessage("");
    setLocalError("");
    setDuplicateState(null);

    let createdDraft = null;

    try {
      createdDraft = requestId
        ? await updateDraft.mutateAsync({
            id: requestId,
            payload: normalizePayload(form),
          })
        : await createDraft.mutateAsync(
            normalizePayload(form),
          );
      await uploadIfNeeded(createdDraft.id);

      if (!submitNow) {
        setSuccessMessage(
          `Draft ${createdDraft.reference} saved successfully.`,
        );
        navigate("/user/requests");
        return;
      }

      const submitted =
        await submitRequest.mutateAsync({
          id: createdDraft.id,
          payload: {
            override_duplicates: false,
          },
        });
      setSuccessMessage(
        `Request ${submitted.reference} submitted successfully.`,
      );
      navigate("/user/requests");
    } catch (error) {
      const duplicates =
        error.errors?.duplicate_requests ?? [];
      if (duplicates.length) {
        setDuplicateState({
          draft: createdDraft,
          duplicates,
        });
        return;
      }

      setLocalError(errorMessage(error));
    }
  }

  async function handleDuplicateOverride() {
    if (!duplicateState?.draft) {
      return;
    }

    try {
      const submitted =
        await submitRequest.mutateAsync({
          id: duplicateState.draft.id,
          payload: {
            override_duplicates: true,
            duplicate_override_reason:
              overrideReason,
          },
        });

      setSuccessMessage(
        `Request ${submitted.reference} submitted with duplicate override.`,
      );
      navigate("/user/requests");
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  }

  return (
    <div className="create-tracker-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Correction Tracker
          </span>
          <h1>
            {requestId
              ? "Continue Draft"
              : "Create Request"}
          </h1>
          <p>
            {requestId
              ? "Continue draft correction details, evidence and submission."
              : "Capture voucher correction details, evidence and submit for approval."}
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/user/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="button button--secondary"
            to="/user/requests"
          >
            My Requests
          </Link>
        </div>
      </div>

      {isLoadingMasters ? (
        <AppLoader label="Loading request masters..." />
      ) : masterError ? (
        <ErrorState
          title="Request masters unavailable"
          message={masterError.message}
        />
      ) : (
        <form
          className="tracker-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave({ submitNow: true });
          }}
        >
          <div className="tracker-form__main">
            {successMessage ? (
              <div className="inline-alert inline-alert--success">
                <strong>{successMessage}</strong>
              </div>
            ) : null}

            {localError ||
            (actionError && !duplicateState) ? (
              <div className="inline-alert inline-alert--error">
                <strong>
                  {localError ||
                    errorMessage(actionError)}
                </strong>
              </div>
            ) : null}

            {duplicateState ? (
              <div className="inline-alert inline-alert--error tracker-duplicate-alert">
                <AlertTriangle size={18} />
                <div>
                  <strong>
                    Duplicate request found.
                  </strong>
                  <p>
                    Existing references:{" "}
                    {duplicateState.duplicates
                      .map(
                        (item) =>
                          item.reference,
                      )
                      .join(", ")}
                  </p>
                </div>
              </div>
            ) : null}

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Draft Validation</h2>
                <span
                  className={
                    missingRequiredCount
                      ? "request-status request-status--warning"
                      : "request-status request-status--success"
                  }
                >
                  {missingRequiredCount
                    ? `${missingRequiredCount} missing`
                    : "Ready"}
                </span>
              </div>
              <div className="surface-card__body">
                <div className="draft-validation-grid">
                  {validationItems.map((item) => (
                    <span
                      key={item.field}
                      className={
                        item.complete
                          ? "draft-validation-chip draft-validation-chip--complete"
                          : "draft-validation-chip"
                      }
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="form-help">
                  Field requirements update from
                  ERP module, voucher type, work
                  type, priority, department and
                  site selection.
                </p>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Requester Information</h2>
              </div>
              <div className="surface-card__body form-grid">
                <label className="form-field">
                  <span>Employee</span>
                  <input
                    value={
                      user?.employee_id ?? "-"
                    }
                    readOnly
                  />
                </label>
                <label className="form-field">
                  <span>Name</span>
                  <input
                    value={
                      user?.full_name ?? "-"
                    }
                    readOnly
                  />
                </label>
                <label className="form-field">
                  <span>Site</span>
                  <select
                    value={form.site}
                    onChange={(event) =>
                      setField(
                        "site",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select site
                    </option>
                    {(sitesQuery.data ?? []).map(
                      (site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.code} -{" "}
                          {site.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="form-field">
                  <span>Department</span>
                  <select
                    value={form.department}
                    onChange={(event) =>
                      setField(
                        "department",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select department
                    </option>
                    {(
                      departmentsQuery.data ?? []
                    ).map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.code} -{" "}
                        {department.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Site PM</span>
                  <input
                    value={
                      sitesDetailQuery.data?.items?.find(
                        (site) =>
                          site.id === form.site,
                      )?.site_hod_detail
                        ?.full_name ?? "-"
                    }
                    readOnly
                  />
                </label>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>ERP And Voucher Information</h2>
              </div>
              <div className="surface-card__body form-grid">
                <label className="form-field">
                  <span>ERP Module</span>
                  <select
                    value={form.erp_module}
                    onChange={(event) =>
                      setField(
                        "erp_module",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select module
                    </option>
                    {(modulesQuery.data ?? []).map(
                      (module) => (
                        <option
                          key={module.id}
                          value={module.id}
                        >
                          {module.code} -{" "}
                          {module.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="form-field">
                  <span>Voucher Type</span>
                  <select
                    value={form.voucher_type}
                    onChange={(event) =>
                      setField(
                        "voucher_type",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select voucher
                    </option>
                    {filteredVouchers.map(
                      (voucher) => (
                        <option
                          key={voucher.id}
                          value={voucher.id}
                        >
                          {
                            voucher.voucher_code
                          }{" "}
                          -{" "}
                          {
                            voucher.voucher_name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {!isFieldHidden(
                  "voucher_number",
                  "REQUIRED",
                ) ? (
                  <label className="form-field">
                  <span>Voucher Number</span>
                  <input
                    value={form.voucher_number}
                    onChange={(event) =>
                      setField(
                        "voucher_number",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "voucher_number",
                      selectedVoucher
                        ?.requires_voucher_number
                        ? "REQUIRED"
                        : "OPTIONAL",
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "voucher_date",
                  "REQUIRED",
                ) ? (
                  <label className="form-field">
                  <span>Voucher Date</span>
                  <input
                    type="date"
                    value={form.voucher_date}
                    onChange={(event) =>
                      setField(
                        "voucher_date",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "voucher_date",
                      selectedVoucher
                        ?.requires_voucher_date
                        ? "REQUIRED"
                        : "OPTIONAL",
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "erp_email_date",
                  "REQUIRED",
                ) ? (
                  <label className="form-field">
                  <span>ERP Email Date</span>
                  <input
                    type="date"
                    value={form.erp_email_date}
                    onChange={(event) =>
                      setField(
                        "erp_email_date",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "erp_email_date",
                      "REQUIRED",
                    )}
                  />
                  </label>
                ) : null}
                <label className="form-field">
                  <span>Root Cause Person</span>
                  <SearchableSelect
                    ariaLabel="Root Cause Person"
                    value={
                      form.root_cause_person
                    }
                    onChange={(nextValue) =>
                      setField(
                        "root_cause_person",
                        nextValue,
                      )
                    }
                    options={
                      rootCausePersonOptions
                    }
                    disabled={!form.site}
                    placeholder={
                      form.site
                        ? "Search employee by name"
                        : "Select a site first"
                    }
                  />
                </label>
                <label className="form-field">
                  <span>HO Work Authority</span>
                  <SearchableSelect
                    ariaLabel="HO Work Authority"
                    value={
                      form.ho_work_authority
                    }
                    onChange={(nextValue) =>
                      setField(
                        "ho_work_authority",
                        nextValue,
                      )
                    }
                    options={
                      hoWorkAuthorityOptions
                    }
                    disabled={!hoSite}
                    placeholder={
                      hoSite
                        ? "Search HO employee by name"
                        : "No Head Office site configured"
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Site Work Authority</span>
                  <SearchableSelect
                    ariaLabel="Site Work Authority"
                    value={
                      form.site_work_authority
                    }
                    onChange={(nextValue) =>
                      setField(
                        "site_work_authority",
                        nextValue,
                      )
                    }
                    options={
                      siteWorkAuthorityOptions
                    }
                    disabled={
                      !form.site ||
                      !form.department
                    }
                    placeholder={
                      form.site && form.department
                        ? "Search employee by name"
                        : "Select a site and department first"
                    }
                  />
                </label>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Correction Details</h2>
              </div>
              <div className="surface-card__body form-grid">
                <label className="form-field">
                  <span>Correction Type</span>
                  <select
                    value={form.work_type}
                    onChange={(event) =>
                      setField(
                        "work_type",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select correction type
                    </option>
                    {workTypes.map((workType) => (
                      <option
                        key={workType.id}
                        value={workType.id}
                      >
                        {
                          workType.work_type_code
                        }{" "}
                        -{" "}
                        {
                          workType.work_type_name
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Reason</span>
                  <select
                    value={
                      form.reason_category
                    }
                    onChange={(event) =>
                      setField(
                        "reason_category",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select reason
                    </option>
                    {(reasonsQuery.data ?? []).map(
                      (reason) => (
                        <option
                          key={reason.id}
                          value={reason.id}
                        >
                          {reason.code} -{" "}
                          {reason.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="form-field">
                  <span>Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setField(
                        "priority",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="" disabled hidden>
                      Select priority
                    </option>
                    {priorities.map((priority) => (
                      <option
                        key={priority.id}
                        value={priority.id}
                      >
                        {
                          priority.priority_code
                        }{" "}
                        -{" "}
                        {
                          priority.priority_name
                        }
                      </option>
                    ))}
                  </select>
                </label>
                {!isFieldHidden(
                  "requested_window_start",
                  "OPTIONAL",
                ) ? (
                  <label className="form-field">
                  <span>Requested Window Start</span>
                  <input
                    type="datetime-local"
                    value={
                      form.requested_window_start
                    }
                    onChange={(event) =>
                      setField(
                        "requested_window_start",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "requested_window_start",
                      "OPTIONAL",
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "requested_window_end",
                  "OPTIONAL",
                ) ? (
                  <label className="form-field">
                  <span>Requested Window End</span>
                  <input
                    type="datetime-local"
                    value={
                      form.requested_window_end
                    }
                    onChange={(event) =>
                      setField(
                        "requested_window_end",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "requested_window_end",
                      "OPTIONAL",
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "amount",
                  amountState,
                ) ? (
                  <label className="form-field">
                  <span>Affected Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setField(
                        "amount",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "amount",
                      amountState,
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "quantity",
                  quantityState,
                ) ? (
                  <label className="form-field">
                  <span>Affected Quantity</span>
                  <input
                    type="number"
                    step="0.001"
                    value={form.quantity}
                    onChange={(event) =>
                      setField(
                        "quantity",
                        event.target.value,
                      )
                    }
                    required={isFieldRequired(
                      "quantity",
                      quantityState,
                    )}
                  />
                  </label>
                ) : null}
                {!isFieldHidden(
                  "description",
                  "REQUIRED",
                ) ? (
                  <label className="form-field tracker-form__wide">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setField(
                        "description",
                        event.target.value,
                      )
                    }
                    rows={4}
                    required={isFieldRequired(
                      "description",
                      "REQUIRED",
                    )}
                  />
                  </label>
                ) : null}
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Attachment</h2>
              </div>
              <div className="surface-card__body">
                <label className="file-upload-control">
                  <Upload size={18} />
                  <span>
                    {attachmentFile
                      ? attachmentFile.name
                      : "Attach PDF, Excel, image or email screenshot"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xlsm,.xls,.csv,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={(event) =>
                      setAttachmentFile(
                        event.target.files?.[0] ??
                          null,
                      )
                    }
                  />
                </label>
              </div>
            </SurfaceCard>

            {duplicateState ? (
              <SurfaceCard>
                <div className="surface-card__header">
                  <h2>Duplicate Override</h2>
                </div>
                <div className="surface-card__body tracker-override">
                  <label className="form-field">
                    <span>Override Reason</span>
                    <textarea
                      value={overrideReason}
                      onChange={(event) =>
                        setOverrideReason(
                          event.target.value,
                        )
                      }
                      rows={3}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={
                      submitRequest.isPending ||
                      overrideReason.trim().length <
                        10
                    }
                    onClick={
                      handleDuplicateOverride
                    }
                  >
                    <Send size={16} />
                    Submit With Override
                  </button>
                </div>
              </SurfaceCard>
            ) : null}
          </div>

          <aside className="tracker-review-panel">
            <SurfaceCard>
              <div className="surface-card__header">
                <h2>Review And Submit</h2>
              </div>
              <div className="surface-card__body">
                <dl className="tracker-review-list">
                  <div>
                    <dt>Site</dt>
                    <dd>
                      {selectLabel(
                        sitesQuery.data ?? [],
                        form.site,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>
                      {selectLabel(
                        departmentsQuery.data ??
                          [],
                        form.department,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Voucher</dt>
                    <dd>
                      {form.voucher_number ||
                        "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>Priority SLA</dt>
                    <dd>
                      {selectedPriority
                        ? `${selectedPriority.sla_duration_hours} hours`
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>Escalation</dt>
                    <dd>
                      {selectedPriority
                        ? `${selectedPriority.escalation_duration_hours} hours`
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>Approval</dt>
                    <dd>
                      {selectedWorkType
                        ? selectedWorkType.requires_approval
                          ? "Required"
                          : "Direct assignment"
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>Average Closure</dt>
                    <dd>
                      {dashboardQuery.data
                        ?.average_closure_time_hours
                        ? `${dashboardQuery.data.average_closure_time_hours} hours`
                        : "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt>Attachment</dt>
                    <dd>
                      {attachmentFile ? (
                        <span className="tracker-attachment-name">
                          <Paperclip size={14} />
                          {attachmentFile.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="tracker-submit-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={isSubmitting}
                    onClick={() =>
                      handleSave({
                        submitNow: false,
                      })
                    }
                  >
                    <Save size={16} />
                    Save Draft
                  </button>
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={isSubmitting}
                  >
                    <Send size={16} />
                    {isSubmitting
                      ? "Submitting..."
                      : "Submit Request"}
                  </button>
                </div>
              </div>
            </SurfaceCard>
          </aside>
        </form>
      )}
    </div>
  );
}
