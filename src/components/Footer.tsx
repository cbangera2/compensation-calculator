export default function Footer() {
  return (
    <footer id="footer" className="text-center text-slate-400 text-xs pb-10">
      <br />
      © {new Date().getFullYear()} Chirag Bangera • Built with Next.js and Tailwind •{" "}
      <a
        href="https://github.com/cbangera2"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-sky-300"
      >
        GitHub
      </a>
      {" "}•{" "}
      <a
        href="https://www.linkedin.com/in/chirag-bangera24/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-sky-300"
      >
        LinkedIn
      </a>
    </footer>
  );
}
