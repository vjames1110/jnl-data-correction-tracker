import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectMonitorReportSheet } from "./ProjectMonitorReportSheet";
import { row } from "./workspaceFixtures";

const NONE = {
  details: false,
  structures: true,
  buildings: false,
  girders: false,
  actionItems: false,
  linearWorks: false,
  financial: false,
  hr: false,
  machinery: false,
};

const STRUCTURE = {
  id: "s1",
  structure_type_name: "Major Bridge",
  name: "Br. No. 11",
  chainage_km: "2400.000",
  overall_progress: { done: 0, total: 5 },
  groups: [
    {
      group_order: 0,
      group_title: "Approvals",
      group_subtitle: "",
      rows: [row("a1", "GAD approval"), row("a2", "Structural drawing")],
    },
    {
      group_order: 1,
      group_title: "Superstructure",
      group_subtitle: "",
      rows: [
        row("s1a", "S1 – Bearings"),
        row("s1b", "S1 – Girder fabrication"),
        row("s2a", "S2 – Bearings"),
        row("s3a", "S3 – Bearings"),
      ],
    },
  ],
};

const trOf = (text) => screen.getByText(text).closest("tr");

describe("ProjectMonitorReportSheet span banding", () => {
  it("bands a group's repeating spans the same way as on screen", () => {
    render(
      <ProjectMonitorReportSheet
        site={{ site_code: "CHK", site_name: "Chunar" }}
        structures={[STRUCTURE]}
        buildings={[]}
        sections={NONE}
      />,
    );

    expect(trOf("Superstructure - S1 – Bearings")).toHaveClass(
      "pm-row--band-a",
    );
    expect(trOf("Superstructure - S1 – Girder fabrication")).toHaveClass(
      "pm-row--band-a",
    );
    expect(trOf("Superstructure - S2 – Bearings")).toHaveClass(
      "pm-row--band-b",
      "pm-row--cluster-start",
    );
    expect(trOf("Superstructure - S3 – Bearings")).toHaveClass(
      "pm-row--band-a",
    );
  });

  it("leaves an ordinary group plain", () => {
    render(
      <ProjectMonitorReportSheet
        site={{ site_code: "CHK", site_name: "Chunar" }}
        structures={[STRUCTURE]}
        buildings={[]}
        sections={NONE}
      />,
    );

    expect(trOf("Approvals - GAD approval").className).not.toMatch(
      /band/,
    );
  });
});
