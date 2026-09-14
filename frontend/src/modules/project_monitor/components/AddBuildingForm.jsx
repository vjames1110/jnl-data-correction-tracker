import { useState } from "react";

const BLANK_FORM = {
  stationLabel: "",
  name: "",
  chainageKm: "",
  gf: 500,
  up: 1,
  uf: 500,
  found: "open",
  piles: 40,
  lift: false,
  fire: false,
  ext: true,
};

export function AddBuildingForm({
  onCreate,
  onCancel,
  isPending,
  error,
}) {
  const [form, setForm] = useState(BLANK_FORM);

  const setField = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onCreate(
      {
        name: form.name,
        station_label: form.stationLabel,
        chainage_km: form.chainageKm || null,
        config: {
          gf: Number(form.gf),
          up: Number(form.up),
          uf: Number(form.uf),
          found: form.found,
          piles: Number(form.piles),
          lift: form.lift,
          fire: form.fire,
          ext: form.ext,
        },
      },
      {
        onSuccess: () => setForm(BLANK_FORM),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="filter-control">
          <span>Site / station</span>
          <input
            type="text"
            value={form.stationLabel}
            onChange={(event) =>
              setField(
                "stationLabel",
                event.target.value,
              )
            }
            placeholder="e.g. Chunar station"
            required
          />
        </label>
        <label className="filter-control">
          <span>Building name</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setField(
                "name",
                event.target.value,
              )
            }
            placeholder="e.g. Station building"
            required
          />
        </label>
        <label className="filter-control">
          <span>Chainage (km)</span>
          <input
            type="number"
            step="0.001"
            value={form.chainageKm}
            onChange={(event) =>
              setField(
                "chainageKm",
                event.target.value,
              )
            }
            placeholder="12.345"
          />
        </label>
        <label className="filter-control">
          <span>Ground floor area (sqm)</span>
          <input
            type="number"
            value={form.gf}
            onChange={(event) =>
              setField(
                "gf",
                event.target.value,
              )
            }
          />
        </label>
        <label className="filter-control">
          <span>No. of upper floors</span>
          <input
            type="number"
            min="0"
            value={form.up}
            onChange={(event) =>
              setField(
                "up",
                event.target.value,
              )
            }
          />
        </label>
        <label className="filter-control">
          <span>
            Typical upper floor area (sqm)
          </span>
          <input
            type="number"
            value={form.uf}
            onChange={(event) =>
              setField(
                "uf",
                event.target.value,
              )
            }
          />
        </label>
        <label className="filter-control">
          <span>Foundation</span>
          <select
            value={form.found}
            onChange={(event) =>
              setField(
                "found",
                event.target.value,
              )
            }
          >
            <option value="open">
              Open / isolated footings
            </option>
            <option value="raft">Raft</option>
            <option value="pile">Pile</option>
          </select>
        </label>
        {form.found === "pile" ? (
          <label className="filter-control">
            <span>Piles (nos)</span>
            <input
              type="number"
              value={form.piles}
              onChange={(event) =>
                setField(
                  "piles",
                  event.target.value,
                )
              }
            />
          </label>
        ) : null}
        <label className="filter-control">
          <span>Lift</span>
          <select
            value={form.lift ? "1" : "0"}
            onChange={(event) =>
              setField(
                "lift",
                event.target.value === "1",
              )
            }
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
        <label className="filter-control">
          <span>Fire fighting</span>
          <select
            value={form.fire ? "1" : "0"}
            onChange={(event) =>
              setField(
                "fire",
                event.target.value === "1",
              )
            }
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
        <label className="filter-control">
          <span>
            Compound wall / external
            development
          </span>
          <select
            value={form.ext ? "1" : "0"}
            onChange={(event) =>
              setField(
                "ext",
                event.target.value === "1",
              )
            }
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      </div>

      <div className="management-panel__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isPending}
        >
          Generate sheet
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
          {error.message}
        </div>
      ) : null}
    </form>
  );
}
