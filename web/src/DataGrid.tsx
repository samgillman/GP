import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ClipboardEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { Column, TableType } from "./data";
import { numeric } from "./data";
import {
  GRID_ROWS,
  GRID_COLUMNS,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
  GridSessionCache,
  clamp,
  rangeBetween,
  contains,
  rowWindow,
  columnOffsets,
  columnAt,
  columnWindow,
  virtualRuns,
  groupLabel,
  nextCell,
  selectionTSV,
  allExcluded,
} from "./data-grid";
import type { GridCell, GridRange } from "./data-grid";
import "./data-grid.css";
export type { GridRange } from "./data-grid";

export type DataGridProps = {
  sheetId: string;
  columns: Column[];
  tableType: TableType;
  colors?: string[];
  onCellChange(column: number, row: number, value: string): void;
  onPaste(
    event: ClipboardEvent<HTMLInputElement>,
    column: number,
    row: number,
  ): void;
  onRenameColumn(column: number, name: string): void;
  onRemoveColumn(column: number): void;
  onRemoveRow(row: number): void;
  onInsertRow?(index: number): void;
  onInsertColumn?(index: number): void;
  onClearRange?(range: GridRange): void;
  // Column index → row indices whose values are excluded from calculations.
  excluded?: ReadonlyMap<number, ReadonlySet<number>>;
  onToggleExcluded?(range: GridRange): void;
  onError?(message: string): void;
  // Publishes user selections and restored selections to linked graph views.
  onSelectionChange?(range: GridRange): void;
  focusCell?: { column: number; row: number; token: number };
  readOnly?: boolean;
};
const sessions = new GridSessionCache();
const consumedFocusTokens = new Map<string, number>();
const selectedSheets = new Set<string>();
const rowOffsets = Array.from(
  { length: GRID_ROWS + 1 },
  (_, i) => i * ROW_HEIGHT,
);
const sessionFor = (id: string) => sessions.read(id);
const initialCell = { row: 0, column: 0 };
type CellHandlers = {
  pointer(event: ReactPointerEvent<HTMLInputElement>, cell: GridCell): void;
  focus(input: HTMLInputElement, cell: GridCell): void;
  doubleClick(input: HTMLInputElement, cell: GridCell): void;
  key(event: KeyboardEvent<HTMLInputElement>, cell: GridCell): void;
  change(cell: GridCell, value: string): void;
  copy(event: ClipboardEvent<HTMLInputElement>, cell: GridCell): void;
  paste(event: ClipboardEvent<HTMLInputElement>, cell: GridCell): void;
  context(event: React.MouseEvent, cell: GridCell): void;
};
const Cell = memo(function Cell({
  row,
  column,
  name,
  value,
  selected,
  active,
  editing,
  excluded,
  readOnly,
  handlers,
}: {
  row: number;
  column: number;
  name: string;
  value: string;
  selected: boolean;
  active: boolean;
  editing: boolean;
  excluded: boolean;
  readOnly: boolean;
  handlers: CellHandlers;
}) {
  const cell = { row, column };
  let invalid = false;
  try {
    numeric(value);
  } catch {
    invalid = true;
  }
  return (
    <td
      role="gridcell"
      aria-colindex={column + 2}
      aria-selected={selected}
      className={`data-grid-cell${selected ? " is-selected" : ""}${active ? " is-active" : ""}${editing ? " is-editing" : ""}${excluded ? " is-excluded" : ""}`}
      title={excluded ? "Excluded from analyses and graphs" : undefined}
    >
      <input
        aria-label={`${name}, row ${row + 1}${excluded ? ", excluded" : ""}`}
        aria-invalid={invalid || undefined}
        className={invalid ? "invalid-cell" : undefined}
        data-row={row}
        data-column={column}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        tabIndex={active ? 0 : -1}
        onPointerDown={(e) => handlers.pointer(e, cell)}
        onFocus={(e) => handlers.focus(e.currentTarget, cell)}
        onDoubleClick={(e) => handlers.doubleClick(e.currentTarget, cell)}
        onKeyDown={(e) => handlers.key(e, cell)}
        onChange={(e) => handlers.change(cell, e.target.value)}
        onCopy={(e) => handlers.copy(e, cell)}
        onPaste={(e) => handlers.paste(e, cell)}
        onContextMenu={(e) => handlers.context(e, cell)}
      />
    </td>
  );
});

type Menu = {
  x: number;
  y: number;
  kind: "row" | "column" | "cell";
  index: number;
};
export default function DataGrid(props: DataGridProps) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const viewport = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState(() => sessionFor(props.sheetId).widths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const [view, setView] = useState(() => {
    const saved = sessionFor(props.sheetId);
    return {
      scrollTop: saved.scrollTop,
      scrollLeft: saved.scrollLeft,
      widths: saved.widths,
      width: 800,
      height: 500,
    };
  });
  const [active, setActive] = useState<GridCell>(
    () => sessionFor(props.sheetId).active,
  );
  const [range, setRange] = useState<GridRange>(
    () => sessionFor(props.sheetId).range,
  );
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [notice, setNotice] = useState("");
  const activeRef = useRef(active),
    rangeRef = useRef(range),
    editingRef = useRef(editing);
  activeRef.current = active;
  rangeRef.current = range;
  editingRef.current = editing;
  const anchor = useRef<GridCell>(sessionFor(props.sheetId).anchor);
  const head = useRef<GridCell>(sessionFor(props.sheetId).head);
  const suppressFocus = useRef(false);
  const pendingFocus = useRef<{ cell: GridCell; edit: boolean } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const resize = useRef<{ column: number; x: number; width: number } | null>(
    null,
  );
  const frame = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const offsets = useMemo(() => columnOffsets(widths), [widths]);
  const actualRows = Math.max(1, ...props.columns.map((c) => c.values.length));
  const saveViewport = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    sessions.update(propsRef.current.sheetId, {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      widths: widthsRef.current,
      active: activeRef.current,
      anchor: anchor.current,
      head: head.current,
      range: rangeRef.current,
    });
  }, []);
  const emitRange = useCallback(
    (next: GridRange, user: boolean) => {
      rangeRef.current = next;
      selectedSheets.add(propsRef.current.sheetId);
      setRange(next);
      saveViewport();
      if (user) propsRef.current.onSelectionChange?.(next);
    },
    [saveViewport],
  );
  const measure = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    setView({
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      width: element.clientWidth,
      height: element.clientHeight,
      widths: widthsRef.current,
    });
  }, []);
  const scrollToCell = useCallback(
    (cell: GridCell) => {
      const element = viewport.current;
      if (!element) return;
      const positions = columnOffsets(widthsRef.current);
      const top = cell.row * ROW_HEIGHT,
        bottom = top + ROW_HEIGHT;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (
        bottom >
        element.scrollTop + element.clientHeight - HEADER_HEIGHT
      )
        element.scrollTop = bottom - element.clientHeight + HEADER_HEIGHT;
      if (positions[cell.column] < element.scrollLeft)
        element.scrollLeft = positions[cell.column];
      else if (
        positions[cell.column + 1] >
        element.scrollLeft + element.clientWidth - ROW_HEADER_WIDTH
      )
        element.scrollLeft =
          positions[cell.column + 1] - element.clientWidth + ROW_HEADER_WIDTH;
      saveViewport();
      measure();
    },
    [measure, saveViewport],
  );
  const focusInput = useCallback((cell: GridCell, edit = false) => {
    const input = viewport.current?.querySelector<HTMLInputElement>(
      `input[data-row="${cell.row}"][data-column="${cell.column}"]`,
    );
    if (!input) return false;
    suppressFocus.current = true;
    input.focus({ preventScroll: true });
    suppressFocus.current = false;
    if (edit) input.setSelectionRange(input.value.length, input.value.length);
    else input.select();
    return true;
  }, []);
  const moveFocus = useCallback(
    (
      cell: GridCell,
      options: {
        extend?: boolean;
        preserve?: boolean;
        user?: boolean;
        edit?: boolean;
        scroll?: boolean;
      } = {},
    ) => {
      const next = {
        row: clamp(cell.row, 0, GRID_ROWS - 1),
        column: clamp(cell.column, 0, GRID_COLUMNS - 1),
      };
      head.current = next;
      activeRef.current = next;
      setActive(next);
      editingRef.current = !!options.edit;
      setEditing(!!options.edit);
      if (!options.preserve) {
        if (!options.extend) anchor.current = next;
        emitRange(rangeBetween(anchor.current, next), options.user ?? true);
      }
      pendingFocus.current = { cell: next, edit: !!options.edit };
      if (options.scroll !== false) scrollToCell(next);
      else saveViewport();
      if (focusInput(next, !!options.edit)) pendingFocus.current = null;
    },
    [emitRange, scrollToCell, focusInput, saveViewport],
  );
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (pending && focusInput(pending.cell, pending.edit))
      pendingFocus.current = null;
  });
  useLayoutEffect(() => {
    const saved = sessionFor(props.sheetId);
    widthsRef.current = saved.widths;
    setWidths(saved.widths);
    anchor.current = saved.anchor;
    head.current = saved.head;
    activeRef.current = saved.active;
    setActive(saved.active);
    rangeRef.current = saved.range;
    setRange(saved.range);
    setEditing(false);
    editingRef.current = false;
    setMenu(null);
    pendingFocus.current = null;
    if (viewport.current) {
      viewport.current.scrollTop = saved.scrollTop;
      viewport.current.scrollLeft = saved.scrollLeft;
    }
    measure();
    const incomingFocus = propsRef.current.focusCell;
    const hasPendingFocus =
      incomingFocus &&
      consumedFocusTokens.get(props.sheetId) !== incomingFocus.token;
    // The parent may currently hold another table's selection. Restore only
    // previously selected ranges, without moving focus or editing the workbook.
    // A new graph-to-cell request already owns the parent's selection and wins.
    if (selectedSheets.has(props.sheetId) && !hasPendingFocus)
      propsRef.current.onSelectionChange?.(saved.range);
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [props.sheetId, measure]);
  useEffect(() => {
    if (
      props.focusCell &&
      consumedFocusTokens.get(props.sheetId) !== props.focusCell.token
    ) {
      consumedFocusTokens.set(props.sheetId, props.focusCell.token);
      moveFocus(props.focusCell, { user: false });
    }
  }, [props.sheetId, props.focusCell?.token, moveFocus]);
  const fail = useCallback((message: string) => {
    setNotice(message);
    propsRef.current.onError?.(message);
  }, []);
  const clearSelection = useCallback(
    (selection: GridRange) => {
      if (propsRef.current.readOnly) {
        fail("Unfreeze this data table before editing it.");
        return;
      }
      if (propsRef.current.onClearRange)
        propsRef.current.onClearRange(selection);
      else if (
        selection.startRow === selection.endRow &&
        selection.startColumn === selection.endColumn
      )
        propsRef.current.onCellChange(
          selection.startColumn,
          selection.startRow,
          "",
        );
      else fail("Clearing a range is unavailable for this table.");
    },
    [fail],
  );
  const pointCell = useCallback((x: number, y: number): GridCell => {
    const element = viewport.current!;
    const rect = element.getBoundingClientRect();
    return {
      row: clamp(
        Math.floor(
          (y - rect.top - HEADER_HEIGHT + element.scrollTop) / ROW_HEIGHT,
        ),
        0,
        GRID_ROWS - 1,
      ),
      column: columnAt(
        Math.max(0, x - rect.left - ROW_HEADER_WIDTH + element.scrollLeft),
        widthsRef.current,
      ),
    };
  }, []);
  const openMenu = useCallback(
    (event: React.MouseEvent, kind: Menu["kind"], index: number) => {
      event.preventDefault();
      setMenu({
        x: Math.min(event.clientX, window.innerWidth - 210),
        y: Math.min(event.clientY, window.innerHeight - 180),
        kind,
        index,
      });
    },
    [],
  );
  const handlers = useMemo<CellHandlers>(
    () => ({
      pointer(event, cell) {
        if (event.button !== 0) return;
        if (
          editingRef.current &&
          activeRef.current.row === cell.row &&
          activeRef.current.column === cell.column &&
          !event.shiftKey
        )
          return;
        event.preventDefault();
        setMenu(null);
        moveFocus(cell, { extend: event.shiftKey });
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          originX: event.clientX,
          originY: event.clientY,
          moved: false,
        };
      },
      focus(input, cell) {
        if (suppressFocus.current) return;
        // Tabbing back into the active cell must preserve a restored range.
        // Pointer selection already commits its new range before focusing.
        if (
          activeRef.current.row === cell.row &&
          activeRef.current.column === cell.column
        ) {
          editingRef.current = false;
          setEditing(false);
          emitRange(rangeRef.current, true);
          input.select();
          return;
        }
        anchor.current = cell;
        head.current = cell;
        activeRef.current = cell;
        setActive(cell);
        editingRef.current = false;
        setEditing(false);
        emitRange(rangeBetween(cell, cell), true);
        input.select();
      },
      doubleClick(input, cell) {
        if (propsRef.current.readOnly) return;
        moveFocus(cell, { edit: true });
        input.setSelectionRange(input.value.length, input.value.length);
      },
      key(event, cell) {
        const mod = event.metaKey || event.ctrlKey;
        if (
          propsRef.current.readOnly &&
          (event.key === "F2" ||
            event.key === "Backspace" ||
            event.key === "Delete" ||
            (!mod && !event.altKey && event.key.length === 1))
        ) {
          event.preventDefault();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setMenu(null);
          moveFocus(cell, { preserve: true });
          return;
        }
        if (event.key === "F2") {
          event.preventDefault();
          moveFocus(cell, { preserve: true, edit: true });
          return;
        }
        if (mod && event.key.toLowerCase() === "a" && !editingRef.current) {
          event.preventDefault();
          anchor.current = initialCell;
          head.current = { row: GRID_ROWS - 1, column: GRID_COLUMNS - 1 };
          emitRange(rangeBetween(anchor.current, head.current), true);
          return;
        }
        if (
          (event.key === "Backspace" || event.key === "Delete") &&
          !editingRef.current
        ) {
          event.preventDefault();
          clearSelection(rangeRef.current);
          return;
        }
        if (mod || event.altKey) return;
        if (
          editingRef.current &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        )
          return;
        const next = nextCell(cell, event.key, event.shiftKey);
        if (next) {
          event.preventDefault();
          moveFocus(next, {
            extend: event.shiftKey && event.key.startsWith("Arrow"),
          });
        }
      },
      change(cell, value) {
        if (propsRef.current.readOnly) return;
        editingRef.current = true;
        setEditing(true);
        propsRef.current.onCellChange(cell.column, cell.row, value);
      },
      copy(event) {
        const selected = rangeRef.current;
        if (
          editingRef.current &&
          selected.startRow === selected.endRow &&
          selected.startColumn === selected.endColumn
        )
          return;
        event.preventDefault();
        event.clipboardData.setData(
          "text/plain",
          selectionTSV(propsRef.current.columns, selected),
        );
      },
      paste(event, cell) {
        if (propsRef.current.readOnly) {
          event.preventDefault();
          fail("Unfreeze this data table before pasting values.");
          return;
        }
        const selected = rangeRef.current;
        if (!event.clipboardData.types.includes("text/plain")) return;
        const text = event.clipboardData.getData("text/plain");
        // A selected rectangle pastes from its upper-left corner, including a
        // single clipboard value. Caret editing keeps native input paste.
        if (!editingRef.current && !/[\t\n\r]/.test(text)) {
          event.preventDefault();
          const target = {
            row: selected.startRow,
            column: selected.startColumn,
          };
          moveFocus(target);
          propsRef.current.onCellChange(target.column, target.row, text);
          return;
        }
        propsRef.current.onPaste(
          event,
          editingRef.current ? cell.column : selected.startColumn,
          editingRef.current ? cell.row : selected.startRow,
        );
      },
      context(event, cell) {
        if (!contains(rangeRef.current, cell)) moveFocus(cell);
        openMenu(event, "cell", cell.row);
      },
    }),
    [moveFocus, emitRange, clearSelection, openMenu],
  );
  useEffect(() => {
    let dragFrame = 0;
    const updateDrag = () => {
      const current = drag.current,
        element = viewport.current;
      if (!current || !current.moved || !element) {
        dragFrame = 0;
        return;
      }
      const rect = element.getBoundingClientRect();
      const dx =
        current.x < rect.left + ROW_HEADER_WIDTH + 18
          ? -18
          : current.x > rect.right - 18
            ? 18
            : 0;
      const dy =
        current.y < rect.top + HEADER_HEIGHT + 18
          ? -18
          : current.y > rect.bottom - 18
            ? 18
            : 0;
      if (dx || dy) {
        element.scrollLeft += dx;
        element.scrollTop += dy;
        saveViewport();
        measure();
      }
      const cell = pointCell(current.x, current.y);
      if (
        cell.row !== head.current.row ||
        cell.column !== head.current.column
      ) {
        head.current = cell;
        emitRange(rangeBetween(anchor.current, cell), true);
      }
      dragFrame = requestAnimationFrame(updateDrag);
    };
    const pointerMove = (event: PointerEvent) => {
      if (resize.current) {
        const current = resize.current;
        const next = [...widthsRef.current];
        next[current.column] = clamp(
          current.width + event.clientX - current.x,
          72,
          400,
        );
        widthsRef.current = next;
        setWidths(next);
        saveViewport();
        return;
      }
      if (!drag.current) return;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      if (
        Math.hypot(
          event.clientX - drag.current.originX,
          event.clientY - drag.current.originY,
        ) > 4
      )
        drag.current.moved = true;
      if (drag.current.moved && !dragFrame)
        dragFrame = requestAnimationFrame(updateDrag);
    };
    const pointerUp = () => {
      const current = drag.current;
      drag.current = null;
      resize.current = null;
      cancelAnimationFrame(dragFrame);
      dragFrame = 0;
      if (current?.moved) moveFocus(head.current, { preserve: true });
    };
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(dragFrame);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [emitRange, pointCell, moveFocus, saveViewport, measure]);
  const selectRow = (row: number) => {
    const column = columnAt(
      viewport.current?.scrollLeft ?? 0,
      widthsRef.current,
    );
    moveFocus({ row, column }, { preserve: true, scroll: false });
    anchor.current = { row, column: 0 };
    head.current = { row, column: GRID_COLUMNS - 1 };
    emitRange(rangeBetween(anchor.current, head.current), true);
  };
  const selectColumn = (column: number) => {
    const row = clamp(
      Math.floor((viewport.current?.scrollTop ?? 0) / ROW_HEIGHT),
      0,
      GRID_ROWS - 1,
    );
    moveFocus({ row, column }, { preserve: true, scroll: false });
    anchor.current = { row: 0, column };
    head.current = { row: GRID_ROWS - 1, column };
    emitRange(rangeBetween(anchor.current, head.current), true);
  };
  const rows = rowWindow(view.scrollTop, view.height, active.row);
  const columns = columnWindow(
    view.scrollLeft,
    view.width,
    widths,
    active.column,
  );
  const rowRuns = virtualRuns(rows, rowOffsets, GRID_ROWS * ROW_HEIGHT);
  const columnRuns = virtualRuns(columns, offsets, offsets[GRID_COLUMNS]);
  const runAction = (action: () => void) => {
    setMenu(null);
    action();
  };
  const copySelection = async () => {
    try {
      await navigator.clipboard.writeText(
        selectionTSV(propsRef.current.columns, rangeRef.current),
      );
    } catch {
      fail(
        "Clipboard access was unavailable. Select the cells and use ⌘C or Ctrl+C.",
      );
    }
  };
  return (
    <div className="data-grid-shell" data-sheet-id={props.sheetId}>
      <div
        className="sheet-wrap data-grid-viewport"
        ref={viewport}
        onScroll={() => {
          saveViewport();
          if (!frame.current)
            frame.current = requestAnimationFrame(() => {
              frame.current = 0;
              measure();
            });
        }}
      >
        <table
          className="sheet data-grid-table"
          role="grid"
          aria-readonly={props.readOnly || undefined}
          aria-label="Data table"
          aria-rowcount={GRID_ROWS + 1}
          aria-colcount={GRID_COLUMNS + 1}
          style={{ width: offsets[GRID_COLUMNS] + ROW_HEADER_WIDTH }}
        >
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH }} />
            {columnRuns.map((run) => (
              <col
                key={run.key}
                style={{
                  width: run.kind === "gap" ? run.size : widths[run.index],
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="data-grid-corner">
                <button
                  aria-label="Select all cells"
                  title="Select all cells"
                  onClick={() => {
                    emitRange(
                      rangeBetween(initialCell, {
                        row: GRID_ROWS - 1,
                        column: GRID_COLUMNS - 1,
                      }),
                      true,
                    );
                    focusInput(activeRef.current);
                  }}
                >
                  ▧
                </button>
              </th>
              {columnRuns.map((run) =>
                run.kind === "gap" ? (
                  <th
                    key={run.key}
                    aria-hidden="true"
                    className="data-grid-column-gap"
                  />
                ) : (
                  <th
                    key={run.key}
                    className={`data-grid-column-header${run.index >= props.columns.length ? " is-empty-column" : ""}`}
                    aria-colindex={run.index + 2}
                    onContextMenu={(e) => {
                      selectColumn(run.index);
                      openMenu(e, "column", run.index);
                    }}
                  >
                    <button
                      className="data-grid-group"
                      aria-label={`Select column ${groupLabel(run.index)}`}
                      onClick={() => selectColumn(run.index)}
                    >
                      {props.tableType === "xy" && run.index === 0
                        ? "X"
                        : `Group ${groupLabel(run.index - (props.tableType === "xy" ? 1 : 0))}`}
                    </button>
                    <input
                      aria-label={`Column ${run.index + 1} name`}
                      value={props.columns[run.index]?.name ?? ""}
                      readOnly={props.readOnly}
                      onChange={(e) =>
                        props.onRenameColumn(run.index, e.target.value)
                      }
                      spellCheck={false}
                    />
                    <span className="data-grid-entry-label">
                      {props.tableType === "xy"
                        ? run.index === 0
                          ? "X"
                          : "Y"
                        : "Values"}
                    </span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize column ${groupLabel(run.index)}`}
                      aria-valuemin={72}
                      aria-valuemax={400}
                      aria-valuenow={widths[run.index]}
                      tabIndex={0}
                      className="data-grid-resize"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        resize.current = {
                          column: run.index,
                          x: e.clientX,
                          width: widths[run.index],
                        };
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight")
                          return;
                        e.preventDefault();
                        const next = [...widthsRef.current];
                        next[run.index] = clamp(
                          next[run.index] + (e.key === "ArrowLeft" ? -8 : 8),
                          72,
                          400,
                        );
                        widthsRef.current = next;
                        setWidths(next);
                        saveViewport();
                      }}
                    />
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rowRuns.map((run) =>
              run.kind === "gap" ? (
                <tr
                  key={run.key}
                  className="data-grid-row-gap"
                  aria-hidden="true"
                  style={{ height: run.size }}
                >
                  <td
                    colSpan={columnRuns.length + 1}
                    style={{ height: run.size }}
                  />
                </tr>
              ) : (
                <tr
                  key={run.key}
                  aria-rowindex={run.index + 2}
                  data-grid-row={run.index}
                >
                  <th className="row-number data-grid-row-number" scope="row">
                    <button
                      aria-label={`Select row ${run.index + 1}`}
                      onClick={() => selectRow(run.index)}
                      onContextMenu={(e) => {
                        selectRow(run.index);
                        openMenu(e, "row", run.index);
                      }}
                    >
                      {run.index + 1}
                    </button>
                  </th>
                  {columnRuns.map((col) =>
                    col.kind === "gap" ? (
                      <td
                        key={col.key}
                        aria-hidden="true"
                        className="data-grid-column-gap"
                      />
                    ) : (
                      <Cell
                        key={col.key}
                        row={run.index}
                        column={col.index}
                        name={
                          props.columns[col.index]?.name ??
                          `Series ${col.index + 1}`
                        }
                        value={
                          props.columns[col.index]?.values[run.index] ?? ""
                        }
                        selected={contains(range, {
                          row: run.index,
                          column: col.index,
                        })}
                        active={
                          active.row === run.index &&
                          active.column === col.index
                        }
                        editing={
                          editing &&
                          active.row === run.index &&
                          active.column === col.index
                        }
                        excluded={
                          !!props.excluded?.get(col.index)?.has(run.index)
                        }
                        handlers={handlers}
                        readOnly={!!props.readOnly}
                      />
                    ),
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="sheet-footer data-grid-footer">
        <span>
          {actualRows.toLocaleString()} rows · {props.columns.length} columns
          <span className="data-grid-selection-count">
            {" "}
            ·{" "}
            {(
              (range.endRow - range.startRow + 1) *
              (range.endColumn - range.startColumn + 1)
            ).toLocaleString()}{" "}
            selected
          </span>
        </span>
      </div>
      {notice && (
        <div className="data-grid-notice" role="status">
          {notice}
          <button
            aria-label="Dismiss grid notice"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {menu && (
        <div
          className="data-grid-context-menu"
          role="menu"
          aria-label={`${menu.kind} actions`}
          style={{ left: Math.max(0, menu.x), top: Math.max(0, menu.y) }}
          ref={menuRef}
        >
          {menu.kind === "row" && (
            <>
              {props.onInsertRow && (
                <button
                  role="menuitem"
                  disabled={props.readOnly || actualRows >= GRID_ROWS}
                  onClick={() =>
                    runAction(() => props.onInsertRow!(menu.index))
                  }
                >
                  Insert row above
                </button>
              )}
              <button
                role="menuitem"
                disabled={props.readOnly || menu.index >= actualRows}
                onClick={() => runAction(() => props.onRemoveRow(menu.index))}
              >
                Delete row
              </button>
              <button
                role="menuitem"
                disabled={props.readOnly}
                onClick={() =>
                  runAction(() =>
                    clearSelection({
                      startRow: menu.index,
                      endRow: menu.index,
                      startColumn: 0,
                      endColumn: GRID_COLUMNS - 1,
                    }),
                  )
                }
              >
                Clear row
              </button>
            </>
          )}
          {menu.kind === "column" && (
            <>
              {props.onInsertColumn && (
                <button
                  role="menuitem"
                  disabled={
                    props.readOnly || props.columns.length >= GRID_COLUMNS
                  }
                  onClick={() =>
                    runAction(() => props.onInsertColumn!(menu.index))
                  }
                >
                  Insert column before
                </button>
              )}
              <button
                role="menuitem"
                disabled={
                  props.readOnly ||
                  menu.index >= props.columns.length ||
                  props.columns.length <= 1
                }
                onClick={() =>
                  runAction(() => props.onRemoveColumn(menu.index))
                }
              >
                Delete column
              </button>
              <button
                role="menuitem"
                disabled={props.readOnly}
                onClick={() =>
                  runAction(() =>
                    clearSelection({
                      startRow: 0,
                      endRow: GRID_ROWS - 1,
                      startColumn: menu.index,
                      endColumn: menu.index,
                    }),
                  )
                }
              >
                Clear column
              </button>
            </>
          )}
          <button
            role="menuitem"
            onClick={() =>
              runAction(() => {
                void copySelection();
              })
            }
          >
            Copy selected cells
          </button>
          {menu.kind === "cell" && (
            <button
              role="menuitem"
              disabled={props.readOnly}
              onClick={() => runAction(() => clearSelection(rangeRef.current))}
            >
              Clear selected cells
            </button>
          )}
          {props.onToggleExcluded && (
            <button
              role="menuitem"
              disabled={props.readOnly}
              title={
                props.readOnly
                  ? "Unfreeze this data table to exclude or include values."
                  : "Keep the values visible but leave them out of analyses and graphs"
              }
              onClick={() =>
                runAction(() => props.onToggleExcluded!(rangeRef.current))
              }
            >
              {allExcluded(props.columns, props.excluded, range)
                ? "Include Values"
                : "Exclude Values"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
