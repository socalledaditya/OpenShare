import React from "react";
import { Sun, Moon, LogOut, LogIn, FolderLock } from "lucide-react";
import { UserProfile } from "../types";

interface HeaderProps {
  currentRoomId: string | null;
  activePeers: number;
  user: UserProfile | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onHomeClick: () => void;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoomId,
  activePeers,
  user,
  darkMode,
  onToggleDarkMode,
  onHomeClick,
  onOpenAuth,
  onOpenDashboard,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <button
            onClick={onHomeClick}
            className="flex items-center gap-2 text-left cursor-pointer group"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-4xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs sm:text-sm tracking-tight transition-transform group-hover:scale-105">
              <img src="/openshare.png" alt="openshare.png" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-neutral-900 dark:text-neutral-100">
              OpenShare
            </span>
          </button>

          {/* Room status (desktop/tablet) */}
          {currentRoomId && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
              <span className="text-neutral-400 dark:text-neutral-500">
                Room
              </span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                {currentRoomId}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activePeers > 1 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span>
                  {activePeers > 1
                    ? `${activePeers} connected`
                    : "Waiting for others"}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
            className="p-1.5 sm:p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* User Auth or Dashboard */}
          {user ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenDashboard}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                title="Manage all your rooms"
              >
                <FolderLock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Rooms</span>
              </button>
              <button
                onClick={onLogout}
                aria-label="Sign out"
                title={`Signed in as ${user.username}`}
                className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              title="Sign in or create account to manage multiple rooms"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
