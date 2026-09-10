export default function StatusBadge({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-leaf-500/10 text-leaf-600" : "bg-red-100 text-red-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-leaf-500" : "bg-red-500"}`} />
      {label}
    </span>
  );
}
