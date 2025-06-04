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
  const [form, setForm] = useState({ nome: '', tipo: '', quantidade: '', local: '', requisitante: '', dataEntrada: '', observacoes: '', imagemUrl: '', codigo: '', movimentacaoInicial: 'entrada' });
  const [materiais, setMateriais] = useState([]);
  const [imagemFile, setImagemFile] = useState(null);
  const [busca, setBusca] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tela, setTela] = useState('cadastro');

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
    let imagemUrl = '';
    if (imagemFile) {
      const storageRef = ref(storage, `materiais/${Date.now()}_${imagemFile.name}`);
      await uploadBytes(storageRef, imagemFile);
      imagemUrl = await getDownloadURL(storageRef);
    }

    const movInicial = {
      tipo: form.movimentacaoInicial,
      quantidade: parseInt(form.quantidade),
      data: new Date().toISOString(),
      usuario: user.email
    };

    const novo = {
      ...form,
      imagemUrl,
      quantidade: form.movimentacaoInicial === 'entrada' ? parseInt(form.quantidade) : 0,
      movimentacoes: [movInicial]
    };

    await addDoc(collection(db, 'materiais'), novo);
    setForm({ nome: '', tipo: '', quantidade: '', local: '', requisitante: '', dataEntrada: '', observacoes: '', imagemUrl: '', codigo: '', movimentacaoInicial: 'entrada' });
    setImagemFile(null);
    setMensagem("Material salvo com sucesso!");
    setTimeout(() => setMensagem(''), 3000);
    carregarMateriais();
  }

  async function excluirMaterial(id) {
    await deleteDoc(doc(db, 'materiais', id));
    carregarMateriais();
  }

  async function registrarMovimentacao(id, tipo) {
    const quantidadeStr = prompt("Quantidade para " + tipo + ":");
    if (!quantidadeStr) return;
    const quantidade = parseInt(quantidadeStr);
    if (isNaN(quantidade) || quantidade <= 0) return alert('Quantidade inválida');

    const refDoc = doc(db, 'materiais', id);
    const snap = await getDocs(collection(db, 'materiais'));
    const mat = snap.docs.find(d => d.id === id).data();

    const novaQtd = tipo === 'entrada'
      ? mat.quantidade + quantidade
      : mat.quantidade - quantidade;

    if (novaQtd < 0) return alert('Estoque insuficiente');

    const novaMov = [...(mat.movimentacoes || []), {
      tipo,
      quantidade,
      data: new Date().toISOString(),
      usuario: user.email
    }];

    await updateDoc(refDoc, {
      quantidade: novaQtd,
      movimentacoes: novaMov
    });

    carregarMateriais();
  }

  const filtrados = materiais.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  function exportarCSV(dados, nomeArquivo) {
    if (!dados || dados.length === 0) return alert("Nenhum dado para exportar");
    const linhas = [Object.keys(dados[0]).join(',')];
    dados.forEach(obj => {
      linhas.push(Object.values(obj).join(','));
    });
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
  }

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: 'auto' }}>
        <h2>Login</h2>
        <input placeholder="E-mail" className="border p-2 w-full mb-2" value={email} onChange={e => setEmail(e.target.value)} /><br />
        <input type="password" placeholder="Senha" className="border p-2 w-full mb-2" value={senha} onChange={e => setSenha(e.target.value)} /><br />
        <button onClick={loginManual}>Entrar</button>
        {erroLogin && <div style={{ color: 'red' }}>{erroLogin}</div>}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: 'auto' }}>
      <h2>Bem-vindo, {user.email}</h2>
      <button onClick={logout}>Sair</button>
      <button onClick={() => setTela('cadastro')}>Cadastrar Material</button>
      <button onClick={() => setTela('busca')}>Buscar Materiais</button>
      <button onClick={() => setTela('relatorio')}>Relatório</button>

      {tela === 'relatorio' && (
        <div>
          <h3>Relatório de Estoque</h3>
          <button onClick={() => exportarCSV(materiais.map(({ movimentacoes, ...rest }) => rest), 'estoque_completo.csv')}>
            Exportar Estoque Atual para Excel
          </button>
          <h4>Buscar Histórico por Código</h4>
          <input placeholder="Código do material" value={busca} onChange={e => setBusca(e.target.value)} /><br />
          {filtrados.length > 0 && filtrados.map(m => (
            <div key={m.id} style={{ border: '1px solid #ccc', marginTop: 10, padding: 10 }}>
              <strong>{m.nome}</strong> - Código: {m.codigo}<br />
              <button onClick={() => exportarCSV(m.movimentacoes || [], `historico_${m.codigo}.csv`)}>
                Exportar Histórico
              </button>
            </div>
          ))}
        </div>
      )}

      {tela === 'busca' && (
        <div>
          <h3>Busca de Materiais</h3>
          <input
            placeholder="Buscar por nome ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <p>Resultados encontrados: {filtrados.length}</p>

          {busca.trim() === '' ? (
            <p>Digite algo no campo de busca para exibir os materiais.</p>
          ) : (
            filtrados.map((m) => (
              <div key={m.id} style={{ border: '1px solid #ccc', padding: 10, marginTop: 10 }}>
                <strong>{m.nome}</strong> — {m.tipo} ({m.quantidade})<br />
                Local: {m.local} | Código: {m.codigo} | Requisitante: {m.requisitante}<br />
                Entrada: {m.dataEntrada}<br />
                {m.imagemUrl && (
                  <img src={m.imagemUrl} alt={m.nome} style={{ maxWidth: 100 }} />
                )}<br />
                Observações: {m.observacoes}<br />
                <button onClick={() => registrarMovimentacao(m.id, 'entrada')}>Entrada</button>
                <button onClick={() => registrarMovimentacao(m.id, 'saida')}>Saída</button>
                <button onClick={() => excluirMaterial(m.id)}>Excluir</button>
                <details>
                  <summary>📜 Histórico</summary>
                  <ul>
                    {m.movimentacoes?.map((mov, i) => (
                      <li key={i}>
                        {mov.tipo === 'entrada' ? '+' : '-'}
                        {mov.quantidade} | {mov.tipo} | {new Date(mov.data).toLocaleString()} | {mov.usuario}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
