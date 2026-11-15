# Third-party notices

`@ngne/editor-ui` is licensed under the MIT licence (`LICENSE`). This file lists the
third-party material the package ships, with its licence. The package's peer dependencies
(`react`, `react-dom`, `radix-ui`, `lucide-react`, `zustand`) are not bundled: each editor
installs them and lists their licences in its own `licences.txt`. The package's own build
bundles no npm package.

## react-remove-scroll-bar licence text (MIT)

Source: the `LICENSE` of <https://github.com/theKashey/react-remove-scroll-bar> at commit
`7301c160`, used as the licence text of `react-remove-scroll-bar` 2.3.8, whose npm package
ships no licence file (a dependency of `radix-ui`). The licences build helper lists it in an
editor's `licences.txt` when the editor bundles that package.

Used in: `src/build/licence-texts/react-remove-scroll-bar.txt` (shipped as
`dist/build/licence-texts/react-remove-scroll-bar.txt`).

```text
MIT License

Copyright (c) 2025 Anton Korzunov <thekashey@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
