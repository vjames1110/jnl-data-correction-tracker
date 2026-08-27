import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { NavLink } from "react-router-dom";

function loadOpenState(storageKey, groupKeys) {
  try {
    const raw = window.localStorage.getItem(
      storageKey,
    );
    if (!raw) {
      return new Set(groupKeys);
    }
    const saved = JSON.parse(raw);
    return new Set(
      groupKeys.filter(
        (key) => saved[key] !== false,
      ),
    );
  } catch {
    return new Set(groupKeys);
  }
}

function saveOpenState(
  storageKey,
  groupKeys,
  openGroups,
) {
  try {
    const toSave = Object.fromEntries(
      groupKeys.map((key) => [
        key,
        openGroups.has(key),
      ]),
    );
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(toSave),
    );
  } catch {
    // Private browsing / storage disabled - the accordion still
    // works for this page load, it just won't remember next time.
  }
}

/**
 * Groups a flat sidebar nav-item list into accordion sections, used
 * by every portal's sidebar. Items without a `group` render as plain
 * top-level links exactly where they appear in `items` (e.g.
 * Dashboard first, a standalone Settings-type link last); consecutive
 * items sharing a `group` collapse into one collapsible section
 * labelled from `groups`. When the sidebar itself is icon-only
 * (`collapsed`), grouping is bypassed and every item renders flat,
 * since there's no room for section headers.
 */
export function SidebarNavGroups({
  prefix,
  items,
  groups,
  collapsed,
  storageKey,
}) {
  const groupKeys = groups.map(
    (group) => group.key,
  );
  const [openGroups, setOpenGroups] = useState(
    () =>
      loadOpenState(storageKey, groupKeys),
  );

  const toggleGroup = (key) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveOpenState(
        storageKey,
        groupKeys,
        next,
      );
      return next;
    });
  };

  const renderLink = (item) => {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.key}
        to={item.path}
        className={({ isActive }) =>
          clsx(
            `${prefix}__link`,
            isActive &&
              `${prefix}__link--active`,
          )
        }
        title={
          collapsed ? item.label : undefined
        }
      >
        <Icon size={collapsed ? 20 : 19} />
        {!collapsed ? (
          <span>{item.label}</span>
        ) : null}
      </NavLink>
    );
  };

  if (collapsed) {
    return items.map(renderLink);
  }

  const sections = [];
  let currentSection = null;

  items.forEach((item) => {
    if (
      item.group &&
      currentSection?.groupKey === item.group
    ) {
      currentSection.items.push(item);
      return;
    }

    if (item.group) {
      currentSection = {
        groupKey: item.group,
        items: [item],
      };
      sections.push(currentSection);
      return;
    }

    currentSection = null;
    sections.push({ item });
  });

  return sections.map((section, index) => {
    if (section.item) {
      return renderLink(section.item);
    }

    const groupMeta = groups.find(
      (group) => group.key === section.groupKey,
    );
    const isOpen = openGroups.has(
      section.groupKey,
    );

    return (
      <div
        key={`${section.groupKey}-${index}`}
        className={`${prefix}__group`}
      >
        <button
          type="button"
          className={`${prefix}__group-header`}
          onClick={() =>
            toggleGroup(section.groupKey)
          }
          aria-expanded={isOpen}
        >
          <span>
            {groupMeta?.label ??
              section.groupKey}
          </span>
          <ChevronDown
            size={14}
            className={clsx(
              `${prefix}__group-chevron`,
              isOpen &&
                `${prefix}__group-chevron--open`,
            )}
          />
        </button>
        {isOpen ? (
          <div
            className={`${prefix}__group-items`}
          >
            {section.items.map(renderLink)}
          </div>
        ) : null}
      </div>
    );
  });
}
