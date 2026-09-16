import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  CalendarEventType,
  CompanyLifecycle,
  DocumentType,
  FollowUpStatus,
  InteractionDirection,
  InteractionResult,
  InteractionType,
  MaintenanceStatus,
  MilestoneStatus,
  OpportunityStage,
  PaymentStatus,
  PrismaClient,
  Priority,
  ProjectStatus,
  QuoteStatus,
  TaskStatus,
  UserRole,
} from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db/env";

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function resetDevelopmentData() {
  await prisma.activityLog.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.maintenanceContract.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.task.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.opportunityStageHistory.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.project.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the development seed in production.");
  }

  await resetDevelopmentData();

  const actor = await prisma.user.create({
    data: {
      name: "Camille Durand",
      email: "camille.durand@versatech.example",
      role: UserRole.ADMIN,
    },
  });

  const atelierHorizon = await prisma.company.create({
    data: {
      name: "Atelier Horizon",
      lifecycleStatus: CompanyLifecycle.QUALIFIED,
      industry: "Architecture d'intérieur",
      website: "https://atelier-horizon.example",
      phone: "+33 1 00 00 00 01",
      email: "contact@atelier-horizon.example",
      address: "12 rue des Ateliers",
      city: "Lyon",
      postalCode: "69003",
      country: "FR",
      source: "Salon professionnel",
      qualificationScore: 72,
      priority: Priority.HIGH,
      description:
        "Agence fictive d'architecture d'intérieur. Données de développement uniquement.",
      contacts: {
        create: [
          {
            firstName: "Inès",
            lastName: "Morel",
            role: "Directrice",
            phone: "+33 1 00 00 00 02",
            email: "ines.morel@atelier-horizon.example",
            preferredChannel: "phone",
            isPrimary: true,
          },
          {
            firstName: "Hugo",
            lastName: "Bernard",
            role: "Chef de projet",
            email: "hugo.bernard@atelier-horizon.example",
            preferredChannel: "email",
          },
        ],
      },
    },
    include: { contacts: true },
  });

  const ines = atelierHorizon.contacts.find((contact) => contact.isPrimary);
  if (!ines) {
    throw new Error("Expected a primary contact for Atelier Horizon.");
  }

  const atelierOpportunity = await prisma.opportunity.create({
    data: {
      companyId: atelierHorizon.id,
      title: "Refonte site vitrine + espace client",
      stage: OpportunityStage.MEETING,
      estimatedValue: "9800.00",
      probability: 55,
      source: "Salon professionnel",
      expectedCloseDate: daysFromNow(21),
    },
  });

  await prisma.opportunityStageHistory.createMany({
    data: [
      {
        opportunityId: atelierOpportunity.id,
        fromStage: null,
        toStage: OpportunityStage.TO_QUALIFY,
        changedAt: daysFromNow(-18),
        changedById: actor.id,
      },
      {
        opportunityId: atelierOpportunity.id,
        fromStage: OpportunityStage.TO_QUALIFY,
        toStage: OpportunityStage.CONTACTED,
        changedAt: daysFromNow(-14),
        changedById: actor.id,
      },
      {
        opportunityId: atelierOpportunity.id,
        fromStage: OpportunityStage.CONTACTED,
        toStage: OpportunityStage.INTERESTED,
        changedAt: daysFromNow(-8),
        changedById: actor.id,
      },
      {
        opportunityId: atelierOpportunity.id,
        fromStage: OpportunityStage.INTERESTED,
        toStage: OpportunityStage.MEETING,
        changedAt: daysFromNow(-2),
        changedById: actor.id,
      },
    ],
  });

  const atelierCall = await prisma.interaction.create({
    data: {
      companyId: atelierHorizon.id,
      contactId: ines.id,
      opportunityId: atelierOpportunity.id,
      type: InteractionType.CALL,
      direction: InteractionDirection.OUTBOUND,
      result: InteractionResult.MEETING_BOOKED,
      subject: "Qualification du besoin site vitrine",
      notes:
        "Intéressée par une vitrine plus claire et un espace client pour le suivi de chantier. RDV visio posé.",
      occurredAt: daysFromNow(-2),
      createdById: actor.id,
    },
  });

  await prisma.followUp.create({
    data: {
      companyId: atelierHorizon.id,
      opportunityId: atelierOpportunity.id,
      contactId: ines.id,
      title: "Préparer le RDV découverte Atelier Horizon",
      dueAt: daysFromNow(1),
      status: FollowUpStatus.PENDING,
      priority: Priority.HIGH,
      sourceInteractionId: atelierCall.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Envoyer l'ordre du jour du RDV",
      description: "Points: parcours actuel, espace client, planning de lancement.",
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      dueAt: daysFromNow(1),
      companyId: atelierHorizon.id,
      opportunityId: atelierOpportunity.id,
      assignedToId: actor.id,
    },
  });

  await prisma.calendarEvent.create({
    data: {
      title: "RDV découverte — Atelier Horizon",
      type: CalendarEventType.MEETING,
      startsAt: daysFromNow(2, 10),
      endsAt: daysFromNow(2, 11),
      companyId: atelierHorizon.id,
      contactId: ines.id,
      opportunityId: atelierOpportunity.id,
    },
  });

  const maisonRivage = await prisma.company.create({
    data: {
      name: "Maison Rivage",
      lifecycleStatus: CompanyLifecycle.CLIENT,
      industry: "Hôtellerie",
      website: "https://maison-rivage.example",
      phone: "+33 2 00 00 00 10",
      email: "hello@maison-rivage.example",
      address: "8 quai du Large",
      city: "Nantes",
      postalCode: "44000",
      country: "FR",
      source: "Recommandation",
      qualificationScore: 90,
      priority: Priority.MEDIUM,
      description:
        "Maison d'hôtes fictive. Client de démonstration, aucune donnée réelle.",
      contacts: {
        create: {
          firstName: "Clara",
          lastName: "Renard",
          role: "Gérante",
          phone: "+33 2 00 00 00 11",
          email: "clara.renard@maison-rivage.example",
          preferredChannel: "email",
          isPrimary: true,
        },
      },
    },
    include: { contacts: true },
  });

  const clara = maisonRivage.contacts[0];

  const maisonOpportunity = await prisma.opportunity.create({
    data: {
      companyId: maisonRivage.id,
      title: "Site booking + identité visuelle",
      stage: OpportunityStage.WON,
      estimatedValue: "14500.00",
      probability: 100,
      source: "Recommandation",
      wonAt: daysFromNow(-40),
    },
  });

  await prisma.opportunityStageHistory.create({
    data: {
      opportunityId: maisonOpportunity.id,
      fromStage: OpportunityStage.QUOTE,
      toStage: OpportunityStage.WON,
      changedAt: daysFromNow(-40),
      changedById: actor.id,
    },
  });

  const maisonProject = await prisma.project.create({
    data: {
      companyId: maisonRivage.id,
      opportunityId: maisonOpportunity.id,
      name: "Refonte Maison Rivage",
      status: ProjectStatus.ACTIVE,
      description: "Site vitrine, moteur de réservation et photos direction artistique.",
      startDate: daysFromNow(-35),
      dueDate: daysFromNow(25),
      amount: "14500.00",
      progress: 45,
    },
  });

  const maisonQuote = await prisma.quote.create({
    data: {
      companyId: maisonRivage.id,
      opportunityId: maisonOpportunity.id,
      projectId: maisonProject.id,
      reference: "DEV-FICTIF-2026-001",
      amountExTax: "12083.33",
      amountTax: "2416.67",
      amountIncTax: "14500.00",
      status: QuoteStatus.ACCEPTED,
      sentAt: daysFromNow(-48),
      acceptedAt: daysFromNow(-40),
      externalUrl: "https://docs.versatech.example/devis/maison-rivage",
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        companyId: maisonRivage.id,
        projectId: maisonProject.id,
        quoteId: maisonQuote.id,
        label: "Acompte 40%",
        amount: "5800.00",
        status: PaymentStatus.PAID,
        dueAt: daysFromNow(-35),
        paidAt: daysFromNow(-34),
        externalReference: "FICTIF-PAY-001",
      },
      {
        companyId: maisonRivage.id,
        projectId: maisonProject.id,
        quoteId: maisonQuote.id,
        label: "Solde 60%",
        amount: "8700.00",
        status: PaymentStatus.PENDING,
        dueAt: daysFromNow(25),
      },
    ],
  });

  await prisma.milestone.createMany({
    data: [
      {
        projectId: maisonProject.id,
        name: "Cadrage et moodboard",
        dueAt: daysFromNow(-20),
        status: MilestoneStatus.DONE,
        completedAt: daysFromNow(-21),
      },
      {
        projectId: maisonProject.id,
        name: "Mise en production",
        dueAt: daysFromNow(25),
        status: MilestoneStatus.PENDING,
      },
    ],
  });

  await prisma.repository.create({
    data: {
      projectId: maisonProject.id,
      provider: "github",
      owner: "versatech-fictif",
      name: "maison-rivage-web",
      url: "https://github.com/versatech-fictif/maison-rivage-web",
      defaultBranch: "main",
      externalId: "repo-fictif-maison-rivage",
    },
  });

  await prisma.maintenanceContract.create({
    data: {
      companyId: maisonRivage.id,
      projectId: maisonProject.id,
      monthlyAmount: "89.00",
      status: MaintenanceStatus.ACTIVE,
      startDate: daysFromNow(26),
      description: "Maintenance fictive : hébergement, sauvegardes, petites évolutions.",
    },
  });

  await prisma.document.create({
    data: {
      name: "Devis accepté Maison Rivage",
      type: DocumentType.QUOTE,
      url: "https://docs.versatech.example/devis/maison-rivage.pdf",
      companyId: maisonRivage.id,
      opportunityId: maisonOpportunity.id,
      projectId: maisonProject.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Livrer la page réservation",
      description: "Calendrier de disponibilité et confirmation e-mail.",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      dueAt: daysFromNow(5),
      companyId: maisonRivage.id,
      projectId: maisonProject.id,
      assignedToId: actor.id,
    },
  });

  await prisma.interaction.create({
    data: {
      companyId: maisonRivage.id,
      contactId: clara.id,
      opportunityId: maisonOpportunity.id,
      type: InteractionType.NOTE,
      direction: InteractionDirection.INTERNAL,
      subject: "Kick-off validé",
      notes: "Photos prévues semaine prochaine. Clara envoie le livret d'accueil.",
      occurredAt: daysFromNow(-12),
      createdById: actor.id,
    },
  });

  const studioNova = await prisma.company.create({
    data: {
      name: "Studio Nova",
      lifecycleStatus: CompanyLifecycle.LEAD,
      industry: "Studio photo",
      website: "https://studio-nova.example",
      phone: "+33 4 00 00 00 20",
      email: "bonjour@studio-nova.example",
      address: "5 impasse des Studios",
      city: "Bordeaux",
      postalCode: "33000",
      country: "FR",
      source: "LinkedIn",
      qualificationScore: 40,
      priority: Priority.NORMAL,
      description: "Studio photo fictif à qualifier. Aucun lien avec un prospect réel.",
      contacts: {
        create: {
          firstName: "Noah",
          lastName: "Petit",
          role: "Fondateur",
          phone: "+33 4 00 00 00 21",
          email: "noah.petit@studio-nova.example",
          preferredChannel: "phone",
          isPrimary: true,
        },
      },
    },
    include: { contacts: true },
  });

  const noah = studioNova.contacts[0];

  const studioOpportunity = await prisma.opportunity.create({
    data: {
      companyId: studioNova.id,
      title: "Site portfolio + prise de rendez-vous",
      stage: OpportunityStage.TO_CONTACT,
      estimatedValue: "4200.00",
      probability: 20,
      source: "LinkedIn",
      expectedCloseDate: daysFromNow(45),
    },
  });

  await prisma.opportunityStageHistory.create({
    data: {
      opportunityId: studioOpportunity.id,
      fromStage: null,
      toStage: OpportunityStage.TO_CONTACT,
      changedAt: daysFromNow(-1),
      changedById: actor.id,
    },
  });

  const studioCall = await prisma.interaction.create({
    data: {
      companyId: studioNova.id,
      contactId: noah.id,
      opportunityId: studioOpportunity.id,
      type: InteractionType.CALL,
      direction: InteractionDirection.OUTBOUND,
      result: InteractionResult.NO_ANSWER,
      subject: "Premier appel de prise de contact",
      notes: "Messagerie. Relance prévue demain matin.",
      occurredAt: daysFromNow(-1),
      createdById: actor.id,
    },
  });

  await prisma.followUp.create({
    data: {
      companyId: studioNova.id,
      opportunityId: studioOpportunity.id,
      contactId: noah.id,
      title: "Rappeler Studio Nova",
      dueAt: daysFromNow(0, 9),
      status: FollowUpStatus.PENDING,
      priority: Priority.NORMAL,
      sourceInteractionId: studioCall.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Préparer le pitch Studio Nova",
      description: "Portfolio, prise de RDV, délais saison mariage.",
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      dueAt: daysFromNow(0, 8),
      companyId: studioNova.id,
      opportunityId: studioOpportunity.id,
      assignedToId: actor.id,
    },
  });

  await prisma.calendarEvent.create({
    data: {
      title: "Appel Studio Nova",
      type: CalendarEventType.CALL,
      startsAt: daysFromNow(0, 9),
      endsAt: daysFromNow(0, 9, 30),
      companyId: studioNova.id,
      contactId: noah.id,
      opportunityId: studioOpportunity.id,
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        actorId: actor.id,
        entityType: "Company",
        entityId: atelierHorizon.id,
        action: "seed.created",
        metadata: { dataset: "development-fictional" },
      },
      {
        actorId: actor.id,
        entityType: "Opportunity",
        entityId: maisonOpportunity.id,
        action: "seed.won",
        metadata: { dataset: "development-fictional" },
      },
      {
        actorId: actor.id,
        entityType: "Company",
        entityId: studioNova.id,
        action: "seed.created",
        metadata: { dataset: "development-fictional" },
      },
    ],
  });

  console.info("Development seed completed (fictional data only).");
  console.info({
    user: actor.email,
    companies: [atelierHorizon.name, maisonRivage.name, studioNova.name],
  });
}

function daysFromNow(days: number, hours = 12, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
