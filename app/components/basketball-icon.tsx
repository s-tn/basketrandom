import type React from "react"
export function Basketball(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93l14.14 14.14" />
      <path d="M14.83 9.17a20 20 0 0 1-5.66 5.66" />
      <path d="M12 2a20 20 0 0 1 0 20" />
      <path d="M2 12h20" />
    </svg>
  )
}

