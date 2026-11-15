// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/data/data-table";

type Row = { id: string; name: string };

// The portalled <div> stands in for a menu popup or its backdrop: rendered inside the cell by React,
// but placed outside the table in the DOM.
const columns: ColumnDef<Row, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span>
        {row.original.name}
        {createPortal(<div data-testid="portalled">menu popup</div>, document.body)}
      </span>
    ),
  },
];

afterEach(cleanup);

describe("DataTable row click", () => {
  const setup = () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={[{ id: "1", name: "Row one" }]} getRowId={(row) => row.id} onRowClick={onRowClick} />);
    return onRowClick;
  };

  it("opens the row when its own cell is clicked", async () => {
    const onRowClick = setup();
    await userEvent.click(screen.getByText("Row one"));
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Row one" });
  });

  it("ignores clicks on portalled content that bubbles through the React tree", async () => {
    const onRowClick = setup();
    await userEvent.click(screen.getByTestId("portalled"));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
