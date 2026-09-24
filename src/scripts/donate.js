const params = new URLSearchParams(location.search);
const page = params.get("origin");

if (page && /^[a-z0-9-]+(\/[a-z0-9-]+)*\/?$/i.test(page)) {
  params.delete("origin");
  const query = params.toString();
  document.getElementById("back").href =
    `/${page.replace(/\/$/, "")}/${query ? "?" + query : ""}${location.hash}`;
  document.getElementById("back-row").hidden = false;
}
