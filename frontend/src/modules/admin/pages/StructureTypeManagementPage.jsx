import { useState } from "react";
import {
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useCreateStructureType,
  useDeleteStructureType,
  useStructureTypes,
  useUpdateStructureType,
} from "../../../hooks/useProjectMonitor";
import {
  ConfigSchemaBuilder,
  GroupTemplatesBuilder,
} from "../components/StructureTypeSchemaBuilder";
import {
  ManagementPanel,
  StatusChip,
} from "../components/OrganizationControls";

const BLANK_FORM = {
  code: "",
  name: "",
  description_template: "",
  include_approval_docs: true,
  display_order: 0,
  is_active: true,
  config_schema: [],
  group_templates: [],
};

function toFormState(definition) {
  return {
    code: definition.code,
    name: definition.name,
    description_template:
      definition.description_template || "",
    include_approval_docs:
      definition.include_approval_docs,
    display_order: definition.display_order,
    is_active: definition.is_active,
    config_schema:
      definition.config_schema || [],
    group_templates:
      definition.group_templates || [],
  };
}

function extractErrorMessages(error) {
  const errors = error?.response?.data?.errors;
  if (!errors) {
    return [error?.message || "Something went wrong."];
  }
  const messages = [];
  Object.values(errors).forEach((value) => {
    if (Array.isArray(value)) {
      messages.push(...value.flat());
    } else if (value) {
      messages.push(String(value));
    }
  });
  return messages.length
    ? messages
    : [error.message];
}

function StructureTypeForm({
  initial,
  copyFrom,
  onSubmit,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(
    initial || BLANK_FORM,
  );

  const setField = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

  const applyCopy = (id) => {
    const source = copyFrom.find(
      (item) => item.id === id,
    );
    if (!source) {
      return;
    }
    setForm((current) => ({
      ...current,
      config_schema:
        source.config_schema || [],
      group_templates:
        source.group_templates || [],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      code: form.code,
      name: form.name,
      description_template:
        form.description_template,
      include_approval_docs:
        form.include_approval_docs,
      display_order: Number(
        form.display_order,
      ),
      is_active: form.is_active,
      config_schema: form.config_schema,
      group_templates: form.group_templates,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Code</span>
          <input
            type="text"
            value={form.code}
            onChange={(event) =>
              setField(
                "code",
                event.target.value,
              )
            }
            placeholder="e.g. FOB"
            required
          />
        </label>
        <label className="form-field">
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setField(
                "name",
                event.target.value,
              )
            }
            placeholder="e.g. Foot Over Bridge"
            required
          />
        </label>
        <label className="form-field">
          <span>Display order</span>
          <input
            type="number"
            value={form.display_order}
            onChange={(event) =>
              setField(
                "display_order",
                event.target.value,
              )
            }
          />
        </label>
        <label className="form-field">
          <span>Include approval docs</span>
          <select
            value={
              form.include_approval_docs
                ? "1"
                : "0"
            }
            onChange={(event) =>
              setField(
                "include_approval_docs",
                event.target.value === "1",
              )
            }
          >
            <option value="1">
              Yes - GAD + Structural drawing
            </option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="form-field">
          <span>Active</span>
          <select
            value={
              form.is_active ? "1" : "0"
            }
            onChange={(event) =>
              setField(
                "is_active",
                event.target.value === "1",
              )
            }
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
        <label className="form-field">
          <span>
            Description shown on each
            structure - use {"{field_key}"}
            placeholders
          </span>
          <input
            type="text"
            value={form.description_template}
            onChange={(event) =>
              setField(
                "description_template",
                event.target.value,
              )
            }
            placeholder="{spans} span(s) FOB"
          />
        </label>
        {copyFrom.length ? (
          <label className="form-field">
            <span>
              Start from an existing type
            </span>
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  applyCopy(
                    event.target.value,
                  );
                }
              }}
            >
              <option value="">
                - select to copy -
              </option>
              {copyFrom.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <h3 style={{ marginTop: 20 }}>
        Input fields
      </h3>
      <p className="sub">
        What the "Add a structure" form
        should ask for.
      </p>
      <ConfigSchemaBuilder
        fields={form.config_schema}
        onChange={(fields) =>
          setField("config_schema", fields)
        }
      />

      <h3 style={{ marginTop: 20 }}>
        Activity groups
      </h3>
      <p className="sub">
        How those inputs turn into the
        activity sheet.
      </p>
      <GroupTemplatesBuilder
        groups={form.group_templates}
        configSchema={form.config_schema}
        onChange={(groups) =>
          setField(
            "group_templates",
            groups,
          )
        }
      />

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Save
        </button>
        <button
          type="button"
          className="button button--tertiary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <div className="inline-alert inline-alert--error">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {error.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

export function StructureTypeManagementPage() {
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] =
    useState(null);

  const typesQuery = useStructureTypes(true);
  const createType = useCreateStructureType();
  const updateType = useUpdateStructureType();
  const deleteType = useDeleteStructureType();

  const types = typesQuery.data || [];

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (definition) => {
    setEditing(definition);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = (payload) => {
    setFormError(null);

    const mutation = editing
      ? updateType.mutateAsync({
          structureTypeId: editing.id,
          payload,
        })
      : createType.mutateAsync(payload);

    mutation
      .then(() => {
        setIsFormOpen(false);
        setEditing(null);
      })
      .catch((error) => {
        setFormError(
          extractErrorMessages(error),
        );
      });
  };

  const handleToggleActive = (definition) => {
    updateType.mutate({
      structureTypeId: definition.id,
      payload: {
        is_active: !definition.is_active,
      },
    });
  };

  const handleDelete = (definition) => {
    if (
      !window.confirm(
        `Delete structure type "${definition.name}"? This only works if no structures use it yet.`,
      )
    ) {
      return;
    }
    deleteType.mutate(definition.id, {
      onError: (error) => {
        window.alert(
          error?.response?.data?.errors
            ?.detail ||
            error?.message ||
            "Could not delete this structure type.",
        );
      },
    });
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Structure Types</h1>
          <p>
            The master of structure types
            (Minor Bridge, Major Bridge, RUB,
            ROB and any new ones you define)
            the "Add a structure" form
            offers - each declares its own
            input fields and how they
            generate activity groups/rows.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={openCreate}
          >
            <Plus size={16} /> Add structure
            type
          </button>
        </div>
      </div>

      {isFormOpen ? (
        <ManagementPanel
          eyebrow="Structure Types"
          title={
            editing
              ? `Edit ${editing.name}`
              : "Add a structure type"
          }
          onClose={() => {
            setIsFormOpen(false);
            setEditing(null);
          }}
        >
          <StructureTypeForm
            initial={
              editing
                ? toFormState(editing)
                : null
            }
            copyFrom={types}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditing(null);
            }}
            isPending={
              createType.isPending ||
              updateType.isPending
            }
            error={formError}
          />
        </ManagementPanel>
      ) : null}

      {typesQuery.isLoading ? (
        <AppLoader label="Loading structure types..." />
      ) : typesQuery.isError ? (
        <ErrorState
          title="Structure types unavailable"
          message={typesQuery.error?.message}
          onRetry={typesQuery.refetch}
        />
      ) : types.length === 0 ? (
        <EmptyState
          title="No structure types yet"
          message="Add your first structure type above."
        />
      ) : (
        <SurfaceCard>
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Input fields</th>
                  <th>Activity groups</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {types.map((definition) => (
                  <tr key={definition.id}>
                    <td>{definition.name}</td>
                    <td>{definition.code}</td>
                    <td>
                      {
                        definition
                          .config_schema
                          .length
                      }
                    </td>
                    <td>
                      {
                        definition
                          .group_templates
                          .length
                      }
                    </td>
                    <td>
                      <StatusChip
                        active={
                          definition.is_active
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            openEdit(
                              definition,
                            )
                          }
                          aria-label="Edit structure type"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            handleToggleActive(
                              definition,
                            )
                          }
                          aria-label={
                            definition.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                          title={
                            definition.is_active
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          onClick={() =>
                            handleDelete(
                              definition,
                            )
                          }
                          aria-label="Delete structure type"
                          title="Delete permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
