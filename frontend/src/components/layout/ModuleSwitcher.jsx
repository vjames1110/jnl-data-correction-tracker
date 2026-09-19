import clsx from "clsx";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getModuleHome } from "../../navigation/moduleRegistry";

/**
 * The module picker at the top of the sidebar. It expands in place
 * (the sidebar clips anything that overflows it), lists only the
 * modules the role can open, and lands on that module's home page.
 * A role with a single module sees its name but no picker; the
 * icon-only sidebar shows one icon button per module instead.
 */
export function ModuleSwitcher({
  role,
  modules,
  activeModule,
  collapsed,
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = (event) => {
      if (
        event.type === "keydown" &&
        event.key !== "Escape"
      ) {
        return;
      }
      if (
        event.type === "mousedown" &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener(
        "mousedown",
        close,
      );
      document.removeEventListener(
        "keydown",
        close,
      );
    };
  }, [isOpen]);

  if (!activeModule) {
    return null;
  }

  const openModule = (module) => {
    setIsOpen(false);
    if (module.key !== activeModule.key) {
      navigate(getModuleHome(role, module.key));
    }
  };

  if (collapsed) {
    return (
      <div
        className="module-switcher module-switcher--collapsed"
        role="group"
        aria-label="Modules"
      >
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.key}
              type="button"
              className={clsx(
                "module-switcher__icon-button",
                module.key === activeModule.key &&
                  "module-switcher__icon-button--active",
              )}
              title={module.label}
              aria-label={module.label}
              aria-current={
                module.key === activeModule.key
                  ? "true"
                  : undefined
              }
              onClick={() => openModule(module)}
            >
              <Icon size={19} />
            </button>
          );
        })}
      </div>
    );
  }

  const ActiveIcon = activeModule.icon;
  const canSwitch = modules.length > 1;

  return (
    <div className="module-switcher" ref={rootRef}>
      <button
        type="button"
        className="module-switcher__trigger"
        onClick={() =>
          canSwitch &&
          setIsOpen((current) => !current)
        }
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? isOpen : undefined}
        aria-label={`Module: ${activeModule.label}`}
        disabled={!canSwitch}
      >
        <span className="module-switcher__chip">
          <ActiveIcon size={18} />
        </span>
        <span className="module-switcher__text">
          <span className="module-switcher__eyebrow">
            Module
          </span>
          <strong>{activeModule.label}</strong>
        </span>
        {canSwitch ? (
          <ChevronsUpDown
            size={16}
            className="module-switcher__caret"
          />
        ) : null}
      </button>

      {isOpen ? (
        <ul
          className="module-switcher__list"
          role="listbox"
          aria-label="Switch module"
        >
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive =
              module.key === activeModule.key;
            return (
              <li key={module.key} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={clsx(
                    "module-switcher__option",
                    isActive &&
                      "module-switcher__option--active",
                  )}
                  onClick={() => openModule(module)}
                >
                  <span className="module-switcher__chip">
                    <Icon size={17} />
                  </span>
                  <span className="module-switcher__text">
                    <strong>{module.label}</strong>
                    <span>{module.description}</span>
                  </span>
                  {isActive ? (
                    <Check
                      size={16}
                      className="module-switcher__check"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
