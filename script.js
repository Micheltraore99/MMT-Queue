/**
 * ==============================================================================
 * FILE D'ATTENTE — CAS D'UNE BANQUE (LOGIQUE MÉTIER DESKTOP PC)
 * Gestion ordonnée chronologique (FIFO)
 * ==============================================================================
 */

/* ==============================================================================
   1. CONFIGURATION DES SERVICES BANCAIRES ET DES GUICHETS
   ============================================================================== */

const BANK_SERVICES = {
  'depot-retrait': {
    id: 'depot-retrait',
    code: 'D',
    name: 'Dépôt et retrait',
    description: 'Versements d\'espèces, retraits immédiats et remises de chèques.',
    icon: 'fa-solid fa-money-bill-transfer',
    avgMinutesPerClient: 4,
    dedicatedCounters: 'Guichets 01, 02'
  },
  'virements': {
    id: 'virements',
    code: 'V',
    name: 'Virements',
    description: 'Virements nationaux, ordres permanents, éditions de RIB et transferts.',
    icon: 'fa-solid fa-paper-plane',
    avgMinutesPerClient: 6,
    dedicatedCounters: 'Guichets 02, 03'
  },
  'ouverture-compte': {
    id: 'ouverture-compte',
    code: 'O',
    name: 'Ouverture de compte',
    description: 'Souscription de comptes courants, formules épargne et dossiers clients.',
    icon: 'fa-solid fa-user-plus',
    avgMinutesPerClient: 12,
    dedicatedCounters: 'Guichets 04, 05'
  },
  'informations': {
    id: 'informations',
    code: 'I',
    name: 'Informations et assistance',
    description: 'Conseils financiers, délivrance d\'attestations et requêtes diverses.',
    icon: 'fa-solid fa-circle-info',
    avgMinutesPerClient: 5,
    dedicatedCounters: 'Guichet 06'
  },
  'cartes': {
    id: 'cartes',
    code: 'C',
    name: 'Services de carte bancaire',
    description: 'Retrait de nouvelle carte, déblocage de code secret et mise en opposition.',
    icon: 'fa-solid fa-credit-card',
    avgMinutesPerClient: 5,
    dedicatedCounters: 'Guichet 05'
  },
  'autres': {
    id: 'autres',
    code: 'A',
    name: 'Autres opérations bancaires',
    description: 'Certifications de chèques, coffres-forts, devises et actes spéciaux.',
    icon: 'fa-solid fa-briefcase',
    avgMinutesPerClient: 8,
    dedicatedCounters: 'Guichets 01, 06'
  }
};

const STORAGE_KEYS = {
  CURRENT_TICKET: 'banque_current_ticket_pc_v3',
  TICKETS_HISTORY: 'banque_history_pc_v3',
  QUEUE_STATE: 'banque_queue_pc_v3',
  SOUND_ENABLED: 'banque_sound_pc_v3'
};

/* ==============================================================================
   2. GESTIONNAIRE D'ÉTAT DE LA FILE D'ATTENTE (ORDONNÉ STRICT FIFO)
   ============================================================================== */

class QueueStateManager {
  constructor() {
    this.state = this.loadState();
  }

  getDefaultState() {
    return {
      currentCall: {
        number: 'D-102',
        serviceId: 'depot-retrait',
        counter: '03',
        calledAt: '10:52'
      },
      recentCalls: [
        { number: 'V-201', counter: '01', time: '10:48', serviceName: 'Virements' },
        { number: 'C-501', counter: '05', time: '10:44', serviceName: 'Services de carte' },
        { number: 'O-301', counter: '02', time: '10:39', serviceName: 'Ouverture de compte' },
        { number: 'I-401', counter: '04', time: '10:33', serviceName: 'Informations' }
      ],
      counters: {
        'D': 105,
        'V': 204,
        'O': 303,
        'I': 404,
        'C': 503,
        'A': 602
      },
      waitingQueue: [
        { number: 'D-103', serviceId: 'depot-retrait', createdAt: Date.now() - 14 * 60000 },
        { number: 'V-202', serviceId: 'virements', createdAt: Date.now() - 11 * 60000 },
        { number: 'D-104', serviceId: 'depot-retrait', createdAt: Date.now() - 9 * 60000 },
        { number: 'O-302', serviceId: 'ouverture-compte', createdAt: Date.now() - 8 * 60000 },
        { number: 'C-502', serviceId: 'cartes', createdAt: Date.now() - 6 * 60000 },
        { number: 'I-402', serviceId: 'informations', createdAt: Date.now() - 5 * 60000 },
        { number: 'V-203', serviceId: 'virements', createdAt: Date.now() - 3 * 60000 },
        { number: 'D-105', serviceId: 'depot-retrait', createdAt: Date.now() - 1 * 60000 }
      ]
    };
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUEUE_STATE);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const def = this.getDefaultState();
    this.saveState(def);
    return def;
  }

  saveState(stateToSave = this.state) {
    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(stateToSave));
    } catch (e) {}
  }

  generateTicket(serviceId) {
    const service = BANK_SERVICES[serviceId];
    if (!service) throw new Error('Service non reconnu');

    const nextCounterNum = (this.state.counters[service.code] || 100) + 1;
    this.state.counters[service.code] = nextCounterNum;
    const ticketNumber = `${service.code}-${nextCounterNum}`;

    const peopleAhead = this.state.waitingQueue.length;
    const position = peopleAhead + 1;
    const estimatedMinutes = Math.max(3, Math.round((position * 4.5) / 2));

    const now = new Date();
    const formattedDate = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const newTicket = {
      number: ticketNumber,
      serviceId: service.id,
      serviceName: service.name,
      serviceCode: service.code,
      createdAt: now.getTime(),
      dateStr: formattedDate,
      timeStr: formattedTime,
      position: position,
      peopleAhead: peopleAhead,
      estimatedMinutes: estimatedMinutes,
      status: 'waiting',
      counterAssigned: null
    };

    this.state.waitingQueue.push({
      number: ticketNumber,
      serviceId: serviceId,
      createdAt: newTicket.createdAt,
      userCreated: true
    });

    this.saveState();
    this.saveCurrentTicket(newTicket);
    this.addToHistory(newTicket);

    return newTicket;
  }

  saveCurrentTicket(ticket) {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_TICKET, JSON.stringify(ticket));
    } catch (e) {}
  }

  getCurrentTicket() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_TICKET);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  clearCurrentTicket() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_TICKET);
    } catch (e) {}
  }

  addToHistory(ticket) {
    try {
      let history = this.getHistory();
      history = history.filter(t => t.number !== ticket.number);
      history.unshift(ticket);
      if (history.length > 5) history = history.slice(0, 5);
      localStorage.setItem(STORAGE_KEYS.TICKETS_HISTORY, JSON.stringify(history));
    } catch (e) {}
  }

  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TICKETS_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  findTicketByNumber(numberQuery) {
    if (!numberQuery) return null;
    const clean = numberQuery.trim().toUpperCase();

    const current = this.getCurrentTicket();
    if (current && current.number === clean) {
      return this.computeLiveStatus(current);
    }

    const history = this.getHistory();
    const foundInHistory = history.find(t => t.number === clean);
    if (foundInHistory) {
      return this.computeLiveStatus(foundInHistory);
    }

    const foundInQueue = this.state.waitingQueue.find(t => t.number === clean);
    if (foundInQueue) {
      const service = BANK_SERVICES[foundInQueue.serviceId];
      const reconstructed = {
        number: foundInQueue.number,
        serviceId: foundInQueue.serviceId,
        serviceName: service ? service.name : 'Opération bancaire',
        serviceCode: service ? service.code : 'X',
        createdAt: foundInQueue.createdAt,
        dateStr: new Date(foundInQueue.createdAt).toLocaleDateString('fr-FR'),
        timeStr: new Date(foundInQueue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        position: 1,
        peopleAhead: 0,
        estimatedMinutes: 4,
        status: 'waiting',
        counterAssigned: null
      };
      return this.computeLiveStatus(reconstructed);
    }

    if (this.state.currentCall && this.state.currentCall.number === clean) {
      return {
        number: clean,
        serviceName: 'Service en guichet',
        status: 'called',
        position: 0,
        peopleAhead: 0,
        estimatedMinutes: 0,
        counterAssigned: this.state.currentCall.counter,
        timeStr: this.state.currentCall.calledAt
      };
    }

    const recent = this.state.recentCalls.find(c => c.number === clean);
    if (recent) {
      return {
        number: clean,
        serviceName: recent.serviceName || 'Service bancaire',
        status: 'called',
        position: 0,
        peopleAhead: 0,
        estimatedMinutes: 0,
        counterAssigned: recent.counter,
        timeStr: recent.time
      };
    }

    return null;
  }

  computeLiveStatus(ticket) {
    if (!ticket) return null;

    if (this.state.currentCall && this.state.currentCall.number === ticket.number) {
      ticket.status = 'called';
      ticket.position = 0;
      ticket.peopleAhead = 0;
      ticket.estimatedMinutes = 0;
      ticket.counterAssigned = this.state.currentCall.counter;
      return ticket;
    }

    const wasCalledRecent = this.state.recentCalls.find(c => c.number === ticket.number);
    if (wasCalledRecent) {
      ticket.status = 'called';
      ticket.position = 0;
      ticket.peopleAhead = 0;
      ticket.estimatedMinutes = 0;
      ticket.counterAssigned = wasCalledRecent.counter;
      return ticket;
    }

    const indexInGlobalQueue = this.state.waitingQueue.findIndex(t => t.number === ticket.number);

    if (indexInGlobalQueue !== -1) {
      ticket.peopleAhead = indexInGlobalQueue;
      ticket.position = indexInGlobalQueue + 1;
      ticket.estimatedMinutes = Math.max(2, Math.round((ticket.position * 4.5) / 2));
      ticket.status = ticket.peopleAhead <= 1 ? 'approaching' : 'waiting';
    }

    return ticket;
  }

  simulateAdvanceQueue() {
    if (this.state.waitingQueue.length === 0) return null;

    const nextTicket = this.state.waitingQueue.shift();
    const service = BANK_SERVICES[nextTicket.serviceId] || { name: 'Opération' };
    const counterNumber = String(Math.floor(Math.random() * 6) + 1).padStart(2, '0');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (this.state.currentCall) {
      this.state.recentCalls.unshift({
        number: this.state.currentCall.number,
        counter: this.state.currentCall.counter,
        time: this.state.currentCall.calledAt,
        serviceName: service.name
      });
      if (this.state.recentCalls.length > 4) this.state.recentCalls.pop();
    }

    this.state.currentCall = {
      number: nextTicket.number,
      serviceId: nextTicket.serviceId,
      counter: counterNumber,
      calledAt: timeNow
    };

    this.saveState();

    const currentTicket = this.getCurrentTicket();
    if (currentTicket && currentTicket.number === nextTicket.number) {
      currentTicket.status = 'called';
      currentTicket.counterAssigned = counterNumber;
      currentTicket.peopleAhead = 0;
      currentTicket.position = 0;
      currentTicket.estimatedMinutes = 0;
      this.saveCurrentTicket(currentTicket);
    }

    return {
      calledTicket: nextTicket.number,
      counter: counterNumber,
      serviceName: service.name
    };
  }

  resetSimulationData() {
    const defaultState = this.getDefaultState();
    this.state = defaultState;
    this.saveState(defaultState);
    this.clearCurrentTicket();
    try {
      localStorage.removeItem(STORAGE_KEYS.TICKETS_HISTORY);
    } catch(e) {}
  }
}

/* ==============================================================================
   3. CARILLON BANCAIRE DOUX
   ============================================================================== */

class BankAudioChime {
  constructor() {
    this.audioCtx = null;
    this.enabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED) !== 'false';
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(this.enabled));
    return this.enabled;
  }

  playCallChime() {
    if (!this.enabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;

      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      gain2.gain.setValueAtTime(0.14, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.9);
    } catch (e) {}
  }

  playTicketBeep() {
    if (!this.enabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }
}

/* ==============================================================================
   4. CONTRÔLEUR D'INTERFACE PC DESKTOP
   ============================================================================== */

class MMTQueueApp {
  constructor() {
    this.queueManager = new QueueStateManager();
    this.audioChime = new BankAudioChime();
    this.selectedService = null;
    this.dom = {};
  }

  init() {
    this.cacheDomElements();
    this.setupAudioButton();
    this.renderServicesGrid();
    this.bindEvents();
    this.renderDisplayBoard();
    this.restoreActiveTicket();
    this.renderSessionHistoryPills();
    this.startClock();
  }

  cacheDomElements() {
    this.dom = {
      audioToggleBtn: document.getElementById('audio-toggle-btn'),
      servicesContainer: document.getElementById('services-grid'),
      kioskModal: document.getElementById('kiosk-modal'),
      kioskModalClose: document.getElementById('kiosk-modal-close'),
      kioskServiceSummary: document.getElementById('kiosk-service-summary'),
      kioskConfirmBtn: document.getElementById('kiosk-confirm-btn'),
      kioskCancelBtn: document.getElementById('kiosk-cancel-btn'),
      ticketStatusTitle: document.getElementById('ticket-status-title'),
      ticketInstructionsText: document.getElementById('ticket-instructions-text'),
      ticketCardContainer: document.getElementById('ticket-card-render'),
      searchTicketInput: document.getElementById('search-ticket-input'),
      searchTicketBtn: document.getElementById('search-ticket-btn'),
      searchResultContainer: document.getElementById('search-result-container'),
      refreshTrackingBtn: document.getElementById('refresh-tracking-btn'),
      sessionHistoryContainer: document.getElementById('session-history-chips'),
      boardCurrentNumber: document.getElementById('board-current-number'),
      boardCurrentCounter: document.getElementById('board-current-counter'),
      boardCurrentTime: document.getElementById('board-current-time'),
      boardRecentCallsList: document.getElementById('board-recent-calls-list'),
      boardWaitingCount: document.getElementById('board-waiting-count'),
      boardAverageWait: document.getElementById('board-average-wait'),
      boardServicesTableBody: document.getElementById('board-services-table-body'),
      heroWaitingClients: document.getElementById('hero-waiting-clients'),
      heroAvgWait: document.getElementById('hero-avg-wait'),
      btnSimulateNext: document.getElementById('btn-simulate-next'),
      btnSimulateReset: document.getElementById('btn-simulate-reset'),
      liveBranchClock: document.getElementById('live-branch-clock')
    };
  }

  startClock() {
    const update = () => {
      if (this.dom.liveBranchClock) {
        this.dom.liveBranchClock.textContent = new Date().toLocaleTimeString('fr-FR');
      }
    };
    update();
    setInterval(update, 1000);
  }

  setupAudioButton() {
    this.updateAudioIcon(this.audioChime.enabled);
  }

  toggleAudio() {
    const isEnabled = this.audioChime.toggle();
    this.updateAudioIcon(isEnabled);
    if (isEnabled) {
      this.audioChime.playTicketBeep();
      this.showToast('Signal sonore bancaire activé', 'info');
    } else {
      this.showToast('Signal sonore mis en sourdine', 'info');
    }
  }

  updateAudioIcon(isEnabled) {
    if (!this.dom.audioToggleBtn) return;
    if (isEnabled) {
      this.dom.audioToggleBtn.innerHTML = `<i class="fa-solid fa-volume-high text-sm text-[#1769AA]"></i>`;
      this.dom.audioToggleBtn.setAttribute('title', 'Son activé');
    } else {
      this.dom.audioToggleBtn.innerHTML = `<i class="fa-solid fa-volume-xmark text-sm text-[#536579]"></i>`;
      this.dom.audioToggleBtn.setAttribute('title', 'Son désactivé');
    }
  }

  /**
   * ÉTAPE 1 : Rendu des 6 services bancaires ordonnés
   */
  renderServicesGrid() {
    if (!this.dom.servicesContainer) return;
    this.dom.servicesContainer.innerHTML = '';

    Object.values(BANK_SERVICES).forEach(service => {
      const inQueue = this.queueManager.state.waitingQueue.filter(t => t.serviceId === service.id).length;
      const waitTimeEst = Math.max(3, inQueue * service.avgMinutesPerClient + 2);

      const card = document.createElement('div');
      card.className = 'service-card group';

      card.innerHTML = `
        <div>
          <div class="flex items-start justify-between mb-3.5">
            <div class="w-12 h-12 rounded-xl bg-[#EAF3FA] text-[#1769AA] border border-[#DCE7F1] flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
              <i class="${service.icon}"></i>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#EAF3FA] text-[#1769AA] border border-[#DCE7F1]">
              Code ${service.code}
            </span>
          </div>
          
          <h3 class="text-base font-bold text-[#10243A] mb-1.5">${service.name}</h3>
          <p class="text-xs text-[#536579] leading-relaxed mb-4">${service.description}</p>
        </div>

        <div>
          <div class="py-2.5 px-3 bg-[#F8FAFC] rounded-lg border border-[#DCE7F1] text-[11px] text-[#536579] flex items-center justify-between mb-4">
            <span class="flex items-center gap-1.5">
              <i class="fa-solid fa-desktop text-[#1769AA]"></i> ${service.dedicatedCounters}
            </span>
            <span class="font-bold text-[#10243A]">~${waitTimeEst} min (${inQueue} en attente)</span>
          </div>

          <button 
            type="button" 
            data-service-id="${service.id}"
            class="btn-choose-service btn-primary w-full !py-2.5 text-xs font-bold">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>Choisir ce service</span>
          </button>
        </div>
      `;

      card.querySelector('.btn-choose-service').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openKioskModal(service.id);
      });

      this.dom.servicesContainer.appendChild(card);
    });
  }

  openKioskModal(serviceId) {
    const service = BANK_SERVICES[serviceId];
    if (!service) return;

    this.selectedService = service;
    const countInQueue = this.queueManager.state.waitingQueue.filter(t => t.serviceId === service.id).length;
    const estWait = Math.max(3, countInQueue * service.avgMinutesPerClient + 2);

    this.dom.kioskServiceSummary.innerHTML = `
      <div class="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE7F1]">
        <div class="w-11 h-11 rounded-lg bg-[#EAF3FA] text-[#1769AA] border border-[#DCE7F1] flex items-center justify-center text-lg">
          <i class="${service.icon}"></i>
        </div>
        <div>
          <h4 class="font-bold text-[#10243A] text-sm">${service.name}</h4>
          <p class="text-xs text-[#536579]">${service.dedicatedCounters}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-center pt-1">
        <div class="p-3 rounded-lg bg-[#FFFFFF] border border-[#DCE7F1]">
          <span class="block text-xs text-[#536579]">Personnes devant</span>
          <span class="text-lg font-bold text-[#10243A]">${countInQueue}</span>
        </div>
        <div class="p-3 rounded-lg bg-[#FFFFFF] border border-[#DCE7F1]">
          <span class="block text-xs text-[#536579]">Attente estimée</span>
          <span class="text-lg font-bold text-[#F4A340]">~${estWait} min</span>
        </div>
      </div>
    `;

    this.dom.kioskModal.classList.remove('hidden');
    this.dom.kioskModal.classList.add('flex');
    this.dom.kioskConfirmBtn.focus();
  }

  closeKioskModal() {
    this.dom.kioskModal.classList.add('hidden');
    this.dom.kioskModal.classList.remove('flex');
    this.selectedService = null;
  }

  confirmGenerateTicket() {
    if (!this.selectedService) return;

    try {
      const ticket = this.queueManager.generateTicket(this.selectedService.id);
      this.closeKioskModal();
      
      this.audioChime.playTicketBeep();
      this.showToast(`Ticket ${ticket.number} créé avec succès !`, 'success');

      this.renderTicketCard(ticket);
      this.renderDisplayBoard();
      this.renderServicesGrid();
      this.renderSessionHistoryPills();

      const target = document.getElementById('mon-ticket');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      console.error(err);
      this.showToast('Erreur lors de la création du ticket', 'warning');
    }
  }

  /**
   * ÉTAPE 2 : Rendu du ticket blanc ordonné (SANS bouton imprimer)
   */
  renderTicketCard(ticket) {
    if (!this.dom.ticketCardContainer) return;
    const liveTicket = this.queueManager.computeLiveStatus(ticket);

    if (this.dom.ticketStatusTitle) {
      if (liveTicket.status === 'called') {
        this.dom.ticketStatusTitle.innerHTML = `<span class="text-[#22C55E]">C'est votre tour !</span> Ticket ${liveTicket.number}`;
      } else if (liveTicket.status === 'approaching') {
        this.dom.ticketStatusTitle.innerHTML = `<span class="text-[#F4A340]">Tour imminent !</span> Ticket ${liveTicket.number}`;
      } else {
        this.dom.ticketStatusTitle.textContent = `Ticket en cours : ${liveTicket.number}`;
      }
    }

    if (this.dom.ticketInstructionsText) {
      if (liveTicket.status === 'called') {
        this.dom.ticketInstructionsText.innerHTML = `Veuillez vous présenter immédiatement au <strong>Guichet ${liveTicket.counterAssigned || '01'}</strong>. Votre conseiller vous attend pour traiter votre opération de <strong>${liveTicket.serviceName}</strong>.`;
      } else if (liveTicket.status === 'approaching') {
        this.dom.ticketInstructionsText.textContent = `Votre numéro sera appelé dans les deux prochains clients. Veuillez vous rapprocher des guichets d'accueil.`;
      } else {
        this.dom.ticketInstructionsText.textContent = `Vous êtes en position ${liveTicket.position} dans la file. Temps d'attente estimé : ~${liveTicket.estimatedMinutes} min. Restez attentif aux annonces sonores.`;
      }
    }

    let statusBadgeClass = 'badge-waiting';
    let statusLabel = 'En attente dans la file';
    let statusIcon = 'fa-regular fa-clock';

    if (liveTicket.status === 'called') {
      statusBadgeClass = 'badge-called font-bold text-sm py-1.5 px-3';
      statusLabel = `Appelé au Guichet ${liveTicket.counterAssigned || '01'} !`;
      statusIcon = 'fa-solid fa-bullhorn';
    } else if (liveTicket.status === 'approaching') {
      statusBadgeClass = 'badge-approaching font-bold text-xs py-1 px-3';
      statusLabel = 'Tour très proche (moins de 2 clients)';
      statusIcon = 'fa-solid fa-bell';
    }

    this.dom.ticketCardContainer.innerHTML = `
      <div class="ticket-container-white p-6 max-w-sm mx-auto shadow-2xl">
        
        <!-- En-tête avec Logo IA officiel -->
        <div class="flex items-center justify-between pb-3.5 border-b border-[#DCE7F1]">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-white border border-[#DCE7F1] p-0.5 overflow-hidden flex items-center justify-center shadow-xs">
              <img 
                src="/src/assets/images/bank_logo_emblem_1791633580489.jpg" 
                alt="Logo Banque" 
                referrerpolicy="no-referrer"
                class="w-full h-full object-contain" />
            </div>
            <div>
              <span class="font-extrabold text-[#10243A] text-base tracking-tight block leading-tight">File d'attente</span>
              <span class="text-[10px] text-[#1769AA] font-bold block uppercase tracking-wider">Cas d'une banque</span>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-[#536579] uppercase tracking-wider">Agence Centrale</span>
        </div>

        <!-- Statut du ticket -->
        <div class="my-3.5 text-center">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}">
            <i class="${statusIcon}"></i>
            <span>${statusLabel}</span>
          </span>
        </div>

        <!-- Numéro de ticket principal (48px) -->
        <div class="text-center my-3 py-4 bg-[#F1F5F9] rounded-2xl border border-[#DCE7F1]">
          <span class="block text-xs font-semibold uppercase tracking-wider text-[#536579] mb-1">Votre numéro de ticket</span>
          <span class="text-5xl font-mono font-black tracking-widest text-[#10243A] block">${liveTicket.number}</span>
        </div>

        <!-- Service choisi -->
        <div class="text-center mb-3">
          <span class="text-xs text-[#536579] block">Opération sélectionnée :</span>
          <span class="text-sm font-bold text-[#1769AA]">${liveTicket.serviceName}</span>
        </div>

        <!-- Perforation de découpe -->
        <div class="ticket-perforation-clean"></div>

        <!-- Grille d'informations ordonnées -->
        <div class="grid grid-cols-2 gap-2.5 text-left text-xs bg-[#F8FAFC] p-3 rounded-xl border border-[#DCE7F1] my-3">
          <div>
            <span class="text-[#536579] block">Votre position :</span>
            <strong class="text-[#10243A] text-sm font-bold">${liveTicket.position > 0 ? liveTicket.position + 'ème' : 'Au guichet'}</strong>
          </div>
          <div>
            <span class="text-[#536579] block">Personnes devant :</span>
            <strong class="text-[#10243A] text-sm font-bold">${liveTicket.peopleAhead}</strong>
          </div>
          <div class="col-span-2 pt-2 border-t border-[#DCE7F1] flex items-center justify-between">
            <span class="text-[#536579]">Temps estimé :</span>
            <strong class="text-[#F4A340] font-bold text-sm">${liveTicket.estimatedMinutes > 0 ? '~' + liveTicket.estimatedMinutes + ' min' : 'Immédiat'}</strong>
          </div>
        </div>

        <!-- Horodatage -->
        <div class="text-center text-[11px] text-[#536579] space-y-0.5">
          <div>Émis à : <span class="font-medium text-[#10243A]">${liveTicket.timeStr || ''}</span></div>
        </div>

        <!-- Code-barres décoratif (SANS BOUTON IMPRESSION) -->
        <div class="mt-3 pt-2.5 border-t border-dashed border-[#DCE7F1] flex flex-col items-center">
          <svg class="w-40 h-7 opacity-75" viewBox="0 0 120 25" preserveAspectRatio="none">
            <rect x="0" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="4" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="7" y="0" width="3" height="25" fill="#10243A"/>
            <rect x="12" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="15" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="20" y="0" width="4" height="25" fill="#10243A"/>
            <rect x="26" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="30" y="0" width="3" height="25" fill="#10243A"/>
            <rect x="35" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="40" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="44" y="0" width="4" height="25" fill="#10243A"/>
            <rect x="51" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="56" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="60" y="0" width="3" height="25" fill="#10243A"/>
            <rect x="65" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="70" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="73" y="0" width="4" height="25" fill="#10243A"/>
            <rect x="80" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="84" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="88" y="0" width="3" height="25" fill="#10243A"/>
            <rect x="94" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="98" y="0" width="4" height="25" fill="#10243A"/>
            <rect x="105" y="0" width="1" height="25" fill="#10243A"/>
            <rect x="108" y="0" width="2" height="25" fill="#10243A"/>
            <rect x="112" y="0" width="3" height="25" fill="#10243A"/>
            <rect x="117" y="0" width="2" height="25" fill="#10243A"/>
          </svg>
          <span class="text-[9px] font-mono text-[#536579] mt-1">${liveTicket.number} • BANQUE-CLIENT</span>
        </div>

      </div>
    `;

    this.renderTrackingDetails(liveTicket);
  }

  restoreActiveTicket() {
    const saved = this.queueManager.getCurrentTicket();
    if (saved) {
      this.renderTicketCard(saved);
    } else {
      if (this.dom.ticketCardContainer) {
        this.dom.ticketCardContainer.innerHTML = `
          <div class="bg-white/10 border border-white/20 rounded-2xl p-8 text-center text-slate-200">
            <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl mx-auto mb-3">
              <i class="fa-solid fa-ticket"></i>
            </div>
            <h4 class="text-base font-bold text-white mb-1">Aucun ticket actif</h4>
            <p class="text-xs text-slate-300 max-w-xs mx-auto mb-4">Sélectionnez un service bancaire à l'Étape 1 pour générer votre ticket d'attente.</p>
            <a href="#services" class="btn-white-on-dark text-xs !py-2 !px-4 inline-flex">
              Choisir un service maintenant
            </a>
          </div>
        `;
      }
    }
  }

  renderSessionHistoryPills() {
    if (!this.dom.sessionHistoryContainer) return;
    const history = this.queueManager.getHistory();

    if (history.length === 0) {
      this.dom.sessionHistoryContainer.innerHTML = `
        <span class="text-xs text-[#536579] italic">Aucun ticket émis dans cette session.</span>
      `;
      return;
    }

    this.dom.sessionHistoryContainer.innerHTML = '';
    history.forEach(t => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#F8FAFC] hover:bg-[#EAF3FA] text-[#1769AA] border border-[#DCE7F1] transition-colors cursor-pointer';
      chip.innerHTML = `
        <i class="fa-solid fa-ticket text-xs"></i>
        <span>${t.number}</span>
      `;
      chip.addEventListener('click', () => {
        if (this.dom.searchTicketInput) {
          this.dom.searchTicketInput.value = t.number;
        }
        this.searchAndDisplayTicket(t.number);
      });
      this.dom.sessionHistoryContainer.appendChild(chip);
    });
  }

  /**
   * ÉTAPE 3 : Suivi en direct du ticket (SANS bouton imprimer)
   */
  renderTrackingDetails(ticket) {
    if (!this.dom.searchResultContainer) return;
    const liveTicket = this.queueManager.computeLiveStatus(ticket);
    const step = liveTicket.status === 'called' ? 4 : (liveTicket.status === 'approaching' ? 3 : 2);

    this.dom.searchResultContainer.innerHTML = `
      <div class="card-white p-6 bg-white">
        
        <div class="flex items-center justify-between pb-4 border-b border-[#DCE7F1]">
          <div class="flex items-center gap-3">
            <span class="text-3xl font-mono font-black text-[#1769AA]">${liveTicket.number}</span>
            <span class="text-base font-bold text-[#10243A]">(${liveTicket.serviceName})</span>
          </div>
          <span class="text-xs text-[#536579]">Position synchronisée à ${new Date().toLocaleTimeString()}</span>
        </div>

        <!-- Chronologie ordonnée à 4 étapes -->
        <div class="py-7 max-w-2xl mx-auto">
          <div class="relative flex items-center justify-between">
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#DCE7F1] z-0"></div>
            <div class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#1769AA] transition-all duration-500 z-0" 
                 style="width: ${step === 1 ? '10%' : (step === 2 ? '38%' : (step === 3 ? '72%' : '100%'))}"></div>

            <!-- Étape 1 -->
            <div class="relative z-10 flex flex-col items-center">
              <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-[#1769AA] text-white ring-4 ring-white shadow-xs">
                <i class="fa-solid fa-check"></i>
              </div>
              <span class="text-xs font-semibold text-[#10243A] mt-2">1. Créé</span>
            </div>

            <!-- Étape 2 -->
            <div class="relative z-10 flex flex-col items-center">
              <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? 'bg-[#1769AA] text-white' : 'bg-[#DCE7F1] text-[#536579]'} ring-4 ring-white shadow-xs">
                <i class="fa-solid fa-hourglass-half"></i>
              </div>
              <span class="text-xs font-semibold ${step >= 2 ? 'text-[#1769AA]' : 'text-[#536579]'} mt-2">2. En attente</span>
            </div>

            <!-- Étape 3 -->
            <div class="relative z-10 flex flex-col items-center">
              <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? 'bg-[#F4A340] text-white' : 'bg-[#DCE7F1] text-[#536579]'} ring-4 ring-white shadow-xs">
                <i class="fa-solid fa-bell"></i>
              </div>
              <span class="text-xs font-semibold ${step >= 3 ? 'text-[#F4A340]' : 'text-[#536579]'} mt-2">3. Prochain appel</span>
            </div>

            <!-- Étape 4 -->
            <div class="relative z-10 flex flex-col items-center">
              <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 4 ? 'bg-[#16845B] text-white ring-[#A7F3D0]' : 'bg-[#DCE7F1] text-[#536579]'} ring-4 ring-white shadow-xs">
                <i class="fa-solid fa-bullhorn"></i>
              </div>
              <span class="text-xs font-semibold ${step >= 4 ? 'text-[#16845B] font-bold' : 'text-[#536579]'} mt-2">4. Appelé</span>
            </div>
          </div>
        </div>

        <!-- Métriques ordonnées -->
        <div class="grid grid-cols-4 gap-4 text-center my-3">
          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE7F1]">
            <span class="block text-xs text-[#536579] mb-1">Votre position</span>
            <span class="text-xl font-bold text-[#10243A]">
              ${liveTicket.position > 0 ? liveTicket.position + 'ème' : 'Au guichet'}
            </span>
          </div>

          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE7F1]">
            <span class="block text-xs text-[#536579] mb-1">Clients devant</span>
            <span class="text-xl font-bold text-[#10243A]">${liveTicket.peopleAhead}</span>
          </div>

          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE7F1]">
            <span class="block text-xs text-[#536579] mb-1">Numéro appelé</span>
            <span class="text-xl font-mono font-bold text-[#1769AA]">
              ${this.queueManager.state.currentCall ? this.queueManager.state.currentCall.number : '--'}
            </span>
          </div>

          <div class="p-3.5 rounded-xl bg-[#FEF6EB] border border-[#FCD34D]">
            <span class="block text-xs text-[#B45309] mb-1">Temps estimé</span>
            <span class="text-xl font-bold text-[#F4A340]">
              ${liveTicket.estimatedMinutes > 0 ? '~' + liveTicket.estimatedMinutes + ' min' : 'Guichet ' + (liveTicket.counterAssigned || '01')}
            </span>
          </div>
        </div>

        <!-- Consigne -->
        <div class="mt-4 p-4 rounded-xl ${liveTicket.status === 'called' ? 'bg-[#E8F5EE] border border-[#A7F3D0] text-[#16845B]' : 'bg-[#EAF3FA] border border-[#DCE7F1] text-[#1769AA]'} text-xs">
          <div class="flex items-center gap-2.5">
            <i class="${liveTicket.status === 'called' ? 'fa-solid fa-circle-check text-base text-[#16845B]' : 'fa-solid fa-circle-info text-base text-[#1769AA]'}"></i>
            <div>
              <strong class="text-sm text-[#10243A]">${liveTicket.status === 'called' ? 'Rendez-vous au guichet !' : 'Ticket enregistré'}</strong>
              <span class="block text-[#536579] mt-0.5">
                ${liveTicket.status === 'called' 
                  ? `Veuillez vous présenter sans attendre au <strong>Guichet ${liveTicket.counterAssigned || '01'}</strong>.`
                  : 'Votre rang progresse automatiquement à chaque appel de client.'}
              </span>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  searchAndDisplayTicket(numberQuery) {
    if (!numberQuery || !numberQuery.trim()) {
      this.showToast('Veuillez entrer un numéro de ticket (ex: D-104)', 'warning');
      return;
    }

    const ticket = this.queueManager.findTicketByNumber(numberQuery);

    if (!ticket) {
      if (this.dom.searchResultContainer) {
        this.dom.searchResultContainer.innerHTML = `
          <div class="card-white p-8 text-center bg-white">
            <div class="w-12 h-12 rounded-xl bg-[#FEF6EB] text-[#F4A340] border border-[#FCD34D] mx-auto flex items-center justify-center text-xl mb-3">
              <i class="fa-solid fa-circle-question"></i>
            </div>
            <h4 class="text-base font-bold text-[#10243A]">Aucun ticket trouvé pour « ${numberQuery.toUpperCase()} »</h4>
            <p class="text-xs text-[#536579] max-w-sm mx-auto mt-1">
              Vérifiez la saisie ou prenez un nouveau ticket à l'Étape 1.
            </p>
          </div>
        `;
      }
      this.showToast('Ticket introuvable', 'warning');
      return;
    }

    this.renderTrackingDetails(ticket);
    this.showToast(`Ticket ${ticket.number} trouvé`, 'success');
  }

  /**
   * ÉTAPE 4 : Rendu du moniteur d'agence
   */
  renderDisplayBoard() {
    const state = this.queueManager.state;
    if (!this.dom.boardCurrentNumber) return;

    if (state.currentCall) {
      this.dom.boardCurrentNumber.textContent = state.currentCall.number;
      this.dom.boardCurrentCounter.textContent = `GUICHET ${state.currentCall.counter}`;
      if (this.dom.boardCurrentTime) {
        this.dom.boardCurrentTime.textContent = state.currentCall.calledAt;
      }
    }

    if (this.dom.boardRecentCallsList) {
      this.dom.boardRecentCallsList.innerHTML = '';
      state.recentCalls.forEach(call => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-lg bg-white border border-[#DCE7F1] flex items-center justify-between text-xs';
        item.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-md bg-[#EAF3FA] text-[#1769AA] font-mono font-bold flex items-center justify-center text-xs border border-[#DCE7F1]">
              ${call.number.charAt(0)}
            </span>
            <div>
              <strong class="font-mono text-[#10243A] text-sm block">${call.number}</strong>
              <span class="text-[11px] text-[#536579]">${call.serviceName}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="font-bold text-[#16845B] text-xs">Guichet ${call.counter}</span>
            <span class="block text-[10px] text-[#536579]">${call.time}</span>
          </div>
        `;
        this.dom.boardRecentCallsList.appendChild(item);
      });
    }

    const totalWaiting = state.waitingQueue.length;
    if (this.dom.boardWaitingCount) {
      this.dom.boardWaitingCount.textContent = totalWaiting;
    }
    if (this.dom.heroWaitingClients) {
      this.dom.heroWaitingClients.textContent = totalWaiting;
    }
    if (this.dom.boardAverageWait) {
      const avgMinutes = Math.max(3, Math.round((totalWaiting * 4.5) / 2));
      this.dom.boardAverageWait.textContent = `~${avgMinutes} min`;
      if (this.dom.heroAvgWait) {
        this.dom.heroAvgWait.textContent = `~${avgMinutes} min`;
      }
    }

    if (this.dom.boardServicesTableBody) {
      this.dom.boardServicesTableBody.innerHTML = '';
      Object.values(BANK_SERVICES).forEach(service => {
        const inService = state.waitingQueue.filter(t => t.serviceId === service.id);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-[#DCE7F1] hover:bg-[#F8FAFC] transition-colors text-xs';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-semibold text-[#10243A]">
            <span class="inline-block w-2 h-2 rounded-full bg-[#1769AA] mr-2"></span>
            ${service.name}
          </td>
          <td class="py-2.5 px-4 font-mono font-bold text-[#1769AA]">${service.code}</td>
          <td class="py-2.5 px-4 font-bold text-[#10243A]">${inService.length}</td>
          <td class="py-2.5 px-4 text-[#F4A340]">~${Math.max(3, inService.length * 4)} min</td>
          <td class="py-2.5 px-4 text-[#536579]">${service.dedicatedCounters}</td>
        `;
        this.dom.boardServicesTableBody.appendChild(tr);
      });
    }
  }

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-solid fa-circle-info text-[#1769AA]';
    if (type === 'success') icon = 'fa-solid fa-circle-check text-[#16845B]';
    if (type === 'warning') icon = 'fa-solid fa-triangle-exclamation text-[#F4A340]';

    toast.innerHTML = `
      <i class="${icon}"></i>
      <span class="text-sm font-medium text-[#10243A]">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  bindEvents() {
    if (this.dom.audioToggleBtn) {
      this.dom.audioToggleBtn.addEventListener('click', () => this.toggleAudio());
    }

    if (this.dom.kioskModalClose) {
      this.dom.kioskModalClose.addEventListener('click', () => this.closeKioskModal());
    }
    if (this.dom.kioskCancelBtn) {
      this.dom.kioskCancelBtn.addEventListener('click', () => this.closeKioskModal());
    }
    if (this.dom.kioskConfirmBtn) {
      this.dom.kioskConfirmBtn.addEventListener('click', () => this.confirmGenerateTicket());
    }

    if (this.dom.searchTicketBtn) {
      this.dom.searchTicketBtn.addEventListener('click', () => {
        const query = this.dom.searchTicketInput ? this.dom.searchTicketInput.value : '';
        this.searchAndDisplayTicket(query);
      });
    }

    if (this.dom.searchTicketInput) {
      this.dom.searchTicketInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.searchAndDisplayTicket(this.dom.searchTicketInput.value);
        }
      });
    }

    if (this.dom.refreshTrackingBtn) {
      this.dom.refreshTrackingBtn.addEventListener('click', () => {
        const icon = this.dom.refreshTrackingBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        
        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
          const current = this.queueManager.getCurrentTicket();
          if (current) {
            this.renderTicketCard(current);
            this.renderTrackingDetails(current);
          }
          this.renderDisplayBoard();
          this.showToast('File d\'attente synchronisée', 'success');
        }, 350);
      });
    }

    if (this.dom.btnSimulateNext) {
      this.dom.btnSimulateNext.addEventListener('click', () => {
        const result = this.queueManager.simulateAdvanceQueue();
        if (result) {
          this.audioChime.playCallChime();
          this.renderDisplayBoard();
          this.renderServicesGrid();
          
          const userTicket = this.queueManager.getCurrentTicket();
          if (userTicket) {
            this.renderTicketCard(userTicket);
            this.renderTrackingDetails(userTicket);
            if (userTicket.number === result.calledTicket) {
              this.showToast(`C'EST VOTRE TOUR ! Rendez-vous au Guichet ${result.counter}`, 'success');
              return;
            }
          }
          
          this.showToast(`Ticket ${result.calledTicket} appelé au Guichet ${result.counter}`, 'success');
        } else {
          this.showToast('Aucun client en attente dans la file', 'warning');
        }
      });
    }

    if (this.dom.btnSimulateReset) {
      this.dom.btnSimulateReset.addEventListener('click', () => {
        if (confirm('Voulez-vous réinitialiser l\'état de la file d\'attente ?')) {
          this.queueManager.resetSimulationData();
          this.renderDisplayBoard();
          this.renderServicesGrid();
          this.renderSessionHistoryPills();
          this.restoreActiveTicket();
          if (this.dom.searchResultContainer) {
            this.dom.searchResultContainer.innerHTML = '';
          }
          this.showToast('File réinitialisée', 'info');
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeKioskModal();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new MMTQueueApp();
  app.init();
  window.MMT_APP = app;
});
