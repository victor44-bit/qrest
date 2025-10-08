function packUserCookie(user: { id: string; email: string; name: string }) {
  const json = JSON.stringify(user);
  return Buffer.from(json, "utf8").toString("base64");
}

export { packUserCookie };