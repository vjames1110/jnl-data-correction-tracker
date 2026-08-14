import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { ChevronDown, X } from "lucide-react";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search...",
  emptyMessage = "No matches found",
  disabled = false,
  ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] =
    useState("");
  const [highlightedIndex, setHighlightedIndex] =
    useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => option.value === value,
      ) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalized = searchText
      .trim()
      .toLowerCase();

    if (!normalized) {
      return options;
    }

    return options.filter((option) =>
      option.label
        .toLowerCase()
        .includes(normalized),
    );
  }, [options, searchText]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
  }, [isOpen]);

  function openMenu() {
    if (disabled || isOpen) {
      return;
    }

    setSearchText(selectedOption?.label ?? "");
    setHighlightedIndex(0);
    setIsOpen(true);
  }

  function selectOption(option) {
    onChange(option.value);
    setIsOpen(false);
  }

  function clearSelection(event) {
    event.stopPropagation();
    onChange("");
    setSearchText("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (
      !isOpen &&
      (event.key === "ArrowDown" ||
        event.key === "Enter")
    ) {
      openMenu();
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        Math.min(
          current + 1,
          filteredOptions.length - 1,
        ),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option =
        filteredOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
    }
  }

  const displayValue = isOpen
    ? searchText
    : (selectedOption?.label ?? "");

  return (
    <div
      className="searchable-select"
      ref={containerRef}
    >
      <div
        className="searchable-select__control"
        onClick={openMenu}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={isOpen}
          autoComplete="off"
          onFocus={(event) => {
            openMenu();
            event.target.select();
          }}
          onChange={(event) => {
            setSearchText(event.target.value);
            setHighlightedIndex(0);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="searchable-select__clear"
            aria-label="Clear selection"
            onClick={clearSelection}
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={15}
            className="searchable-select__chevron"
          />
        )}
      </div>

      {isOpen ? (
        <ul
          className="searchable-select__menu"
          role="listbox"
        >
          {!filteredOptions.length ? (
            <li className="searchable-select__empty">
              {emptyMessage}
            </li>
          ) : (
            filteredOptions.map(
              (option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={clsx(
                      "searchable-select__option",
                      option.value === value &&
                        "searchable-select__option--selected",
                      index ===
                        highlightedIndex &&
                        "searchable-select__option--highlighted",
                    )}
                    onMouseEnter={() =>
                      setHighlightedIndex(index)
                    }
                    onClick={() =>
                      selectOption(option)
                    }
                  >
                    {option.label}
                  </button>
                </li>
              ),
            )
          )}
        </ul>
      ) : null}
    </div>
  );
}
