import { getPreviousResults } from "./math";
import "./styles.css";
import React from "react";

import sha256 from "crypto-js/sha256";

function hashFromUrl() {
  if (!window.location.search) return;
  var res = window.location.search
    .substr(1)
    .split("&")
    .map((x) => x.split("="))
    .find(([k, v]) => k === "hash");
  if (res) return res[1];
}

const hasNonEmptyStringValues = (obj) => {
  return Object.keys(obj).every((key) => {
    const value = obj[key];
    return (
      (typeof value === "string" && value.trim() !== "") ||
      typeof value === "number"
    );
  });
};

export default function App() {
  const [state, setState] = React.useState({
    amount: 30,
    hash: hashFromUrl() || "",
  });

  const [result, setResult] = React.useState(null);

  const showMore = () => {
    setState((state) => ({ ...state, amount: state.amount * 2 }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setState((state) => ({ ...state, ...{ [name]: value } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { clientSeed, serverSeed, nonce, risk, rows } = seedPairs;

    console.log(seedPairs);

    if (hasNonEmptyStringValues(seedPairs)) {
      setResult(calculate(risk, rows, serverSeed, clientSeed, nonce));
    } else {
      return;
    }
  };

  const { hash, amount } = state;
  const [current, ...previous] = getPreviousResults(hash, amount);

  return (
    <div className="App">
      <div>
        <p>
          For game results before 19.11.2025 16:30 UTC see{" "}
          <a href="https://codesandbox.io/embed/lf6uy" target="_blank">
            https://codesandbox.io/embed/lf6uy
          </a>
        </p>
        <p>
          For game results before 02.01.2026 see{" "}
          <a
            href="https://codesandbox.io/embed/crash-verifier-h846zc?hidenavigation=1&initialpath=%2F%3Fhash%3D&view=preview"
            target="_blank"
          >
            https://codesandbox.io/embed/crash-verifier-h846zc
          </a>
        </p>

        <table>
          <thead>
            <tr>
              <th>Game hash</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <label>
                  First hash:{" "}
                  <input
                    value={state.hash}
                    onChange={handleChange}
                    name="hash"
                  />
                </label>
              </td>
              {hash && <Result {...current} />}
            </tr>
            {hash &&
              previous.map((result) => (
                <tr key={result.hash}>
                  <td>
                    <pre>{result.hash}</pre>
                  </td>
                  <Result {...result} />
                </tr>
              ))}
          </tbody>
        </table>
        {hash && <button onClick={showMore}>Show more</button>}
      </div>
    </div>
  );
}

const Result = (result) => (
  <td style={{ background: result.color }}>{result.result}</td>
);
