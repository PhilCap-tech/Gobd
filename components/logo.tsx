export function Logo() {
  return (
    <span className="logo-lockup">
      <svg
        className="logo-mark"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="8" fill="currentColor" />
        <path
          fill="#fff"
          d="M12.5 10h9.4l6.6 6.6V29a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
        />
        <path fill="currentColor" d="M21.9 10v6.6H28.5L21.9 10z" />
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          d="M15.2 22.2h8.2M15.2 26h5.4"
        />
      </svg>
      <span className="logo-word">GoBD Verfahrensdoku</span>
    </span>
  );
}
