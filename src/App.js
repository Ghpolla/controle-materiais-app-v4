// App.js completo com todas as funcionalidades solicitadas

import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import * as XLSX from 'xlsx';

const firebaseConfig = {
  apiKey: "AIzaSyCSoQWqSwrTEC748SB9qwPF0RENVS1iO68",
  authDomain: "controle-estoque-sbv.firebaseapp.com",
  projectId: "controle-estoque-sbv",
  storageBucket: "controle-estoque-sbv.appspot.com",
  messagingSenderId: "887418479944",
  appId: "1:887418479944:web:3c7809068f9f88d2b0ff7d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ nome: '', tipo: '', quantidade: '', local: '', requisitante: '', dataEntrada: '', observacoes: '', imagemUrl: '', codigo: '' });
  const [materiais, setMateriais] = useState([]);
  const [imagemFile, setImagemFile] = useState(null);
  const [busca, setBusca] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tela, setTela] = useState('entrada');

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        carregarMateriais();
      } else {
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    gerarCodigo();
  }, [form.nome, form.tipo]);

  async function loginManual() {
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      setErroLogin('');
    } catch (err) {
      setErroLogin('Login inválido');
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  async function carregarMateriais() {
    const snap = await getDocs(collection(db, 'materiais'));
    const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setMateriais(lista);
  }

  function gerarCodigo() {
    if (!form.nome || !form.tipo) return;
    const iniciais = form.nome.split(' ').map(p => p[0]).join('').toUpperCase();
    const tipo = form.tipo.split(' ').map(p => p.slice(0, 3).toUpperCase()).join('');
    const sequencial = (materiais.length + 1).toString().padStart(4, '0');
    const codigo = `${iniciais}-${tipo}-${sequencial}`;
    setForm(f => ({ ...f, codigo }));
  }

  async function salvarMaterial() {
    if (isNaN(form.quantidade)) {
      alert("Quantidade deve ser número");
      return;
    }
    let imagemUrl = '';
    if (imagemFile) {
      const storageRef = ref(storage, `materiais/${Date.now()}_${imagemFile.name}`);
      await uploadBytes(storageRef, imagemFile);
      imagemUrl = await getDownloadURL(storageRef);
    }
    const novo = { ...form, imagemUrl, quantidade: parseInt(form.quantidade), movimentacoes: [
      {
        tipo: 'entrada',
        quantidade: parseInt(form.quantidade),
        data: new Date().toISOString(),
        usuario: user.email
      }
    ]};
    await addDoc(collection(db, 'materiais'), novo);
    setForm({ nome: '', tipo: '', quantidade: '', local: '', requisitante: '', dataEntrada: '', observacoes: '', imagemUrl: '', codigo: '' });
    setImagemFile(null);
    setMensagem("Salvo com sucesso!");
    carregarMateriais();
    setTimeout(() => setMensagem(''), 3000);
  }

  function exportarRelatorio(tipo) {
    let dados;
    if (tipo === 'estoque') {
      dados = materiais.map(m => ({ Código: m.codigo, Nome: m.nome, Tipo: m.tipo, Quantidade: m.quantidade, Local: m.local, Requisitante: m.requisitante }));
    } else {
      const codigo = prompt("Informe o código do material para extrair o histórico");
      const mat = materiais.find(m => m.codigo === codigo);
      if (!mat) return alert("Material não encontrado");
      dados = mat.movimentacoes.map(m => ({ Tipo: m.tipo, Quantidade: m.quantidade, Data: new Date(m.data).toLocaleString(), Usuário: m.usuario }));
    }
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `relatorio_${tipo}.xlsx`);
  }

  const filtrados = materiais.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: 'auto' }}>
        <h2>Login</h2>
        <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} /><br />
        <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} /><br />
        <button onClick={loginManual}>Entrar</button>
        {erroLogin && <div style={{ color: 'red' }}>{erroLogin}</div>}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: 'auto' }}>
      <h2>Bem-vindo, {user.email}</h2>
      <button onClick={logout}>Sair</button>
      <button onClick={() => setTela('entrada')}>Tela Entrada</button>
      <button onClick={() => setTela('busca')}>Tela Busca</button>
      <button onClick={() => setTela('relatorio')}>Relatórios</button>

      {tela === 'entrada' && (
        <div>
          <h3>Cadastro de Material</h3>
          <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /><br />
          <input placeholder="Tipo" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} /><br />
          <input placeholder="Quantidade" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value.replace(/\D/g, '') })} /><br />
          <input placeholder="Local" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} /><br />
          <input placeholder="Requisitante" value={form.requisitante} onChange={e => setForm({ ...form, requisitante: e.target.value })} /><br />
          <input type="date" value={form.dataEntrada} onChange={e => setForm({ ...form, dataEntrada: e.target.value })} /><br />
          <input type="file" accept="image/*" capture="environment" onChange={e => setImagemFile(e.target.files[0])} /><br />
          <input placeholder="Código" value={form.codigo} disabled /><br />
          <input placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /><br />
          <button onClick={salvarMaterial}>Salvar</button>
          {mensagem && <div style={{ color: 'green' }}>{mensagem}</div>}
        </div>
      )}

      {tela === 'busca' && (
        <div>
          <h3>Buscar Materiais</h3>
          <input placeholder="Buscar por nome ou código" value={busca} onChange={e => setBusca(e.target.value)} /><br />
          {busca.trim() && filtrados.map(m => (
            <div key={m.id} style={{ border: '1px solid #ccc', padding: 10, marginTop: 10 }}>
              <strong>{m.nome}</strong> — {m.tipo} ({m.quantidade})<br />
              Local: {m.local} | Código: {m.codigo} | Requisitante: {m.requisitante}<br />
              Entrada: {m.dataEntrada}<br />
              {m.imagemUrl && <img src={m.imagemUrl} alt={m.nome} style={{ maxWidth: 100 }} />}<br />
              Observações: {m.observacoes}<br />
              <details>
                <summary>📜 Histórico</summary>
                <ul>
                  {m.movimentacoes?.map((mov, i) => (
                    <li key={i}>
                      {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade} | {mov.tipo} | {new Date(mov.data).toLocaleString()} | {mov.usuario}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}

      {tela === 'relatorio' && (
        <div>
          <h3>Relatórios</h3>
          <button onClick={() => exportarRelatorio('estoque')}>📦 Estoque Atual</button>
          <button onClick={() => exportarRelatorio('historico')}>📋 Histórico de Material</button>
        </div>
      )}
    </div>
  );
}
