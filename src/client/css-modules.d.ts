/** Ambient declaration for hashed CSS Modules imports. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
