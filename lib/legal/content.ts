/**
 * Legal content — copied verbatim from the mobile app.
 *
 * Source of truth: cancerbuddyapp/src/components/layouts/PrivacyTermsContract/PrivacyTerms.examples.ts
 * Do NOT rewrite or paraphrase. If the mobile app's copy changes, mirror it here.
 */

export interface LegalBlock {
  /** Top-level section title (renders as h2) */
  title?: string;
  /** Numbered or named subsection (renders as h3) */
  subtitle?: string;
  /** Question/lead-in styled phrase (renders as h4 or emphasised paragraph) */
  subtitleAlt?: string;
  /** Body paragraphs in order */
  text?: string[];
  /** Bulleted list */
  list?: string[];
}

export interface LegalDocument {
  /** Document slug used in routing */
  slug: "privacy" | "child-safety" | "terms";
  /** Page title */
  title: string;
  /** Short summary bullets shown at-a-glance (matches mobile "card" copy) */
  summary: string[];
  /** Full document content */
  blocks: LegalBlock[];
}

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Your privacy comes first",
  summary: [
    "You decide what information to share.",
    "You may manually delete any information in your account at anytime.",
    "Only your first name will be seen by the community.",
  ],
  blocks: [
    {
      title: "Your privacy comes first",
      text: [
        "The Bone Marrow & Cancer Foundation has created CancerBuddy™ as a welcoming, safe, empowering resource for patients, caregivers and survivors. This means:",
      ],
    },
    {
      subtitleAlt: "You decide what information to share.",
      list: [
        "Personal information is requested to access and optimize app features.",
        "Opt-outs are provided, so that users can decide what information they choose to share and delete their data entirely.",
      ],
    },
    {
      subtitleAlt: "Only your first name will be seen by the community.",
      list: [
        "Privacy safeguards are built into the app to help protect sensitive information and younger app users.",
        "Community Guidelines established in the Terms of Use reinforce respectful conduct by all.",
      ],
    },
    {
      subtitleAlt: "Your personal information won’t be shared with outside parties.",
      list: [
        "Data sharing is limited to CancerBuddy™ and BMCF service providers and partners, as outlined in our policy.",
        "CancerBuddy™ users are not allowed to use the app for commercial purposes, as agreed in the Terms of Use.",
        "Policy changes can be reviewed anytime to ensure informed consent – and your questions are always welcome.",
      ],
    },
    {
      subtitleAlt: "For details, review our privacy policy below.",
      text: [
        "If you have any questions, comments or concerns about our privacy policy or practices, please contact us at cancerbuddy@bonemarrow.org.",
      ],
    },
    {
      title: "CancerBuddy™ Privacy Policy",
      text: [
        "Below is the full CancerBuddy™ Privacy Policy, covering:\n\n1. Personal Information\n2. Privacy Safeguards\n3. Data sharing\n4. Policy changes",
        "The Bone Marrow and Cancer Foundation, Inc. (hereinafter, “BMCF,” or “we” or “our”) owns and operates the CancerBuddy™ mobile application (the “App”). This privacy policy (the “Policy”) is intended to provide you with information regarding our policies, practices and procedures as they relate to information we collect through the App, including the types of personal information we collect on the App, how we may use that information and with whom we may share it. Please note that this Policy applies only to our information-gathering, processing and sharing practices through the App, and therefore it does not apply to any of the information (and related practices) that we may collect via other means, methods or channels – such as offline, the BMCF website, or any other means.",
      ],
    },
    {
      subtitle: "1. Personal information",
      subtitleAlt: "What personal information does the App collect, and how is it used?",
      text: [
        "You can download the App to your mobile device without having to provide us with any personally identifying information. However, if you want to utilize any of the functionality of the App, you will need to register and then login to your account. If you register and create an account, you will be asked to provide some personally identifiable information, including your name and email address. You will also be asked to provide a user name – please note that your user name will be publicly displayed when you use the App, so please don’t choose a user name that can identify you if you do not wish to be identified. In regard to the information that we collect when you register, we sometimes use this information to communicate with you, or as further described in this Policy. The App does not collect precise real-time location information of your mobile device.",
      ],
    },
    {
      subtitleAlt: "How is non-personally identifiable information/data collected and used?",
      text: [
        "The App may collect certain non-personally identifiable information automatically from your use of the App and its functions in order to allow us to monitor and improve the user experience and diagnose issues. We may collect this information ourselves, or through third-party analytic services such as Google Analytics. A representative, non-exhaustive list of the types of non-personally identifiable information collected may include: the mobile network you’re using, your internet protocol address, operating system, screen size and other default system operations.",
        "Additionally, we may use such technologies like cookies (small files stored by your mobile web browser or “webview”), beacons, or unique device identifiers to identify your mobile device, and collect information on your online activities. We may use this information internally to help us provide you with a more personalized user experience.",
        "We also track usage events in the App, and if you register then we may tie that usage with personally identifiable information (e.g., whether and to whom you may have shared your activities with); usage may also be linked to a particular mobile operating system, app version, and mobile device. We do not resell or redistribute this information for commercial gain, and all of this information is stored in your account in a database that is hosted by BMCF.",
      ],
    },
    {
      subtitleAlt: "How can users opt out?",
      text: [
        "You can manually delete any information in your account at any time, and you can also stop us from collecting information via the App by uninstalling, deleting or otherwise removing the App from your mobile device. We will retain any user-provided data for as long as you use the App and for a reasonable time thereafter. Please note that some your user-provided information may be required in order for the App to function properly, or we may be required to retain certain information pursuant to applicable law or regulation.",
        "If you would like to request that we delete the personally identifiable information that you have provided to us via the App, please contact us at cancerbuddy@bonemarrow.org and we will endeavor to respond to any commercially reasonable requests within a reasonable timeframe.",
      ],
    },
    {
      subtitle: "2. Privacy safeguards",
      subtitleAlt: "How does the App help keep data secure?",
      text: [
        "Your privacy is important to us, and we have put in place security systems designed to prevent unauthorized disclosure and use of your private information. In the case of any third-party providers, we have asked for similar assurances. The security systems in place are structured to deter and prevent hackers and others from accessing your information. Due to the nature of Internet communications and evolving technologies, however, we cannot provide, and disclaim, assurance that such information and communications will remain free from loss, misuse, or alteration by human error or third parties who, despite our security measures efforts, may obtain unauthorized access.",
      ],
    },
    {
      subtitle: "3. Data sharing",
      subtitleAlt: "How does the App limit third-party data access?",
      text: [
        "We may disclose all of the information (described herein) that we collect, as stated in this Policy, including in accordance with the terms set forth in this section. BMCF works with a variety of partners in order to allow us to make the App available to you, to host and store the information we collect from you, to process and disburse donations, and to provide certain functionality and features. Other than as described in this Policy, we will not be providing third parties with access to information obtained by the App. When we do share your information with any such third parties, we will share such information pursuant to the obligations described in this Policy.",
        "Additionally, we may disclose both personally and non-personally identifiable information as follows:",
      ],
      list: [
        "as required by law, such as to comply with a subpoena or similar legal process;",
        "when we believe in good faith that disclosure is necessary to protect BMCF’s rights, protect your safety or the safety of others, investigate fraud, or to respond to a government request;",
        "with service providers who work on behalf of BMCF, such as the BMCF application developers and technical team. These service providers will be given access to such information only for the purposes related to the App, and will be asked to adhere to the rules set forth in this Policy;",
        "if we are involved in any type of organizational change, in which case you will be notified via email or prominent notice of any change of ownership, and you will also be informed of any choices you may have regarding the use of your information at that time.",
      ],
    },
    {
      subtitle: "Can the App be used for commercial purposes?",
      text: [
        "The App may present advertisements, and certain community features may be sponsored by third parties. However, App users are not allowed to use the App for commercial purposes, and any user who attempts to use the App for monetary gain may be reported and removed from the App.",
      ],
    },
    {
      subtitle: "4. Policy changes",
      text: [
        "We reserve the right to change, alter, replace, revise or otherwise modify this Policy at any time. The date of last modification is stated at the end of this Policy. It is your responsibility to check this page from time to time for updates. If we make any material changes to this Policy – as determined by us, in our sole discretion – then we will provide notice of such change via the App or will email you using the email you provided to us when you registered; your continued use of the App after such notice will indicate your acknowledgement and agreement with any and all such changes. This Policy is not intended to and does not create any contractual or other legal right in or on behalf of any party.",
      ],
    },
    {
      subtitleAlt: "Informed consent",
      text: [
        "By using the App, you are consenting to our processing of your information and the collection of other information and data by the App, as further described in this Policy. You acknowledge that in regard to any third-party providers referenced in this Policy we exercise no control over their policies, procedure or practices, and we specifically disclaim any representations, warranties or assurances thereof. In regard to our vendors, however, we will endeavor to have these third-party providers agree to the terms of this Policy.",
        "We do not represent or warrant that the App, or any part thereof, are appropriate or available for use in any particular geographic location. If you choose to use the App, you do so on your own initiative and at your own risk, and are responsible for complying with all local laws, rules, and regulations applicable in your jurisdiction. We reserve the right to limit the App’s availability, in whole or in part, to any person, geographic area, or jurisdiction we choose, at any time and in our sole discretion. If you are using the App from outside the United States, please be aware that your information may be transferred to, stored or processed in the United States, where the App is hosted and where the database resides. The data protection and other laws of the United States and other countries might not be as comprehensive as those in your country, but please be assured that we take steps to protect your privacy as further detailed in this Policy. By using the App, you understand that your information may be transferred to those facilities and those third parties with whom we share it as described in this Policy.",
        "If you have any questions, comments or concerns about our privacy policy or practices, please contact us at cancerbuddy@bonemarrow.org",
      ],
    },
    {
      subtitleAlt: "Policy effective date: 1.17.22",
    },
  ],
};

export const CHILD_SAFETY: LegalDocument = {
  slug: "child-safety",
  title: "Child Safety Standards",
  summary: [
    "Content is age-appropriate, avoiding adult themes and harmful activities.",
    "We comply with COPPA, ensuring parental consent for users under 13.",
    "Strict policies against CSAM/CSAE, with reports to authorities if detected.",
  ],
  blocks: [
    {
      title: "Child Safety Standards Policy",
    },
    {
      subtitleAlt: "Purpose",
      text: [
        "This Child Safety Standards Policy (the “Policy”) demonstrates the Bone Marrow & Cancer Foundation’s unwavering commitment to the safety and wellbeing of children and young people. It outlines the actions, roles, and responsibilities required to protect children and comply with legislative requirements. Policy outlines our commitment to comply with regulations such as the Children’s Online Privacy Protection Act (COPPA) in the United States and similar laws globally, as well as Google Play’s Child Safety Standards. This policy applies to all aspects of our mobile app, from design and development to operation and maintenance.",
      ],
    },
    {
      subtitleAlt: "Scope",
      text: [
        "This Policy applies to all individuals associated with the Bone Marrow & Cancer Foundation, including board members, staff, volunteers, contractors, consultants, and anyone engaged in activities involving children and young people. It covers all programs, events, and services where children are present or may be impacted.",
      ],
    },
    {
      title: "Key Elements",
    },
    {
      subtitleAlt: "1. Age Appropriateness",
      list: [
        "Content: All content within the app is appropriate for the age group it targets. We ensure no adult themes, including excessive violence, gore, or encouragement of harmful activities, are included.",
      ],
    },
    {
      subtitleAlt: "2. Data Privacy and Protection",
      text: [
        "COPPA Compliance: For users under 13 within the U.S., we adhere to COPPA by obtaining verifiable parental consent before collecting, using, or disclosing personal information from children.",
      ],
      list: [
        "Information Collection: We collect only what is necessary for the app’s functionality, such as basic user interaction data for improving user experience. Sensitive data like location or contact details are only collected with explicit parental consent.",
        "Privacy Policy: Our Privacy Policy is written in clear, easy-to-understand language, detailing what information we collect, how it’s used, and with whom it might be shared. Parents have the right to review, delete, or refuse further collection of their child’s personal data.",
      ],
    },
    {
      subtitleAlt: "3. User Interaction and Safety Features",
    },
    {
      subtitleAlt: "4. Safety Against Exploitation",
      text: [
        "Child Sexual Abuse Material (CSAM) and Child Sexual Abuse and Exploitation (CSAE)",
      ],
      list: [
        "We have strict policies against the creation, distribution, or storage of any CSAM and CSAE. We will report any detected CSAM/CSAE to appropriate authorities.",
      ],
    },
    {
      subtitleAlt: "5. Transparency",
      text: [
        "User Guidance: Instructions on how to use parental controls, manage privacy settings, and understand the app’s safety features are clearly accessible.",
      ],
    },
    {
      subtitleAlt: "6. Continuous Improvement and Accountability",
      list: [
        "Feedback Mechanism: We welcome feedback from users, especially parents, to continually improve our safety measures.",
        "Regular Audits: We conduct internal and external audits to ensure compliance with this policy and evolving legal standards.",
        "Policy Updates: This Policy will be reviewed and updated periodically or as necessary in response to new legislation or safety findings.",
      ],
    },
    {
      title: "Contact Information for Child Safety Officer:",
      text: ["cancerbuddy@bonemarrow.org"],
    },
    {
      title: "Effective Date",
      text: [
        "This Policy is effective from April 22, 2025 and will be updated as needed to reflect changes in our practices, technology, or regulatory requirements.",
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  slug: "terms",
  title: "Terms of use",
  summary: [
    "For everyone’s well-being, leave medical advice to the experts.",
    "If you are 12 years old or younger, you will require adult supervision to use this app.",
    "Information shared in the app is for mutual support, not for public or commercial use.",
    "To maintain a supportive community, please be kind and respectful.",
  ],
  blocks: [
    {
      title: "Important",
      text: [
        "This is a legal agreement between you and the Bone Marrow and Cancer Foundation (hereafter “BMCF” or “we” or “our”), the owner of the BMCF CancerBuddy™ App (“the App”). Before accessing, downloading or using any part of the App, you should read carefully the following terms and conditions contained in this terms of use agreement (the “TOU”), because your access to and use of the App – and any services, content, tools, material or information available through the App – are subject to these Terms of Use, as well as to all applicable laws and regulations, along with any other terms and conditions set forth by BMCF. BMCF is willing to license and allow the use of the App only on the condition that you accept and agree to all of the terms and conditions contained in the TOU, including the Community Guidelines (see below). If you do not agree with the TOU, you are not granted permission to access or otherwise use the App and are instructed to delete or otherwise remove the App from your mobile device immediately.",
        "The TOU may be changed or updated from time to time without advance notice. The date the terms of use were last updated is stated at the end of this document. You are encouraged to review these terms of use periodically for updates and changes. You acknowledge and agree that if you continue to use the App after these terms of use have been changed or updated, you will be bound by the revised TOU.",
      ],
    },
    {
      title: "Terms and conditions",
      subtitle: "Description of the Service",
      text: [
        "The BMCF CancerBuddy™ App provides access to an online community where individuals who are in treatment for cancer, in recovery, or who is a caregiver to someone with cancer, can connect, find support, share experiences, and engage in a community.",
      ],
    },
    {
      subtitle: "Registration and Restrictions",
      text: [
        "You can download the App without being required to register or provide us with any personally identifying information. However, in order to utilize any of the features and functionality of the App, you will be required to register in order to create an account (the “Account”). As part of the registration process, you will be asked to provide certain information about yourself, including your name, email and birth month and year. You will also be asked to create a username and password. The username and password that you provide are your credentials (“Credentials”), and you will use these Credentials in order for the App to authenticate you as a registered user of the App.",
        "You may not have more than one active set of Credentials. Additionally, you are prohibited from selling, trading, or otherwise transferring your Credentials to another party. You also agree to provide true, accurate, current and complete information about yourself as prompted during the registration process. If you provide any information that is untrue, inaccurate, non-current or incomplete (or becomes untrue, inaccurate, or non-current), or BMCF has reasonable grounds to suspect that such information is untrue, inaccurate, not current or incomplete, we reserve the right to suspend or terminate your Account and refuse any and all current or future use of the App. You are responsible for maintaining the confidentiality of your Credentials and for restricting access to your device. You agree to accept responsibility for all activities that occur under your Account. You agree to notify us immediately – by emailing us at CancerBuddy™@bonemarrow.org – of any unauthorized use of your Account or any other breach of security.",
        "Any personally identifying information you provide to us is governed by our Privacy Policy – located within the App under Settings – and you hereby acknowledge and agree to any such use and further specified therein.",
      ],
    },
    {
      subtitle: "Acknowledgments",
      text: [
        "By downloading, accessing, or using the App you represent that you are at least 13 years of age. If you are less than 13 years of age, you are prohibited from using the App unless you have the express permission of your parent/guardian. In addition, you agree to abide by all applicable local, state, national, and international laws and regulations with respect to your use of the App. In addition, you also acknowledge and agree that use of the Internet and access to or transmissions or communications with the App is solely at your own risk. While BMCF has endeavored to create a secure and reliable App, you should understand that the confidentiality of any communication or material transmitted to/from the App over the Internet or other form of global communication network cannot be guaranteed. Accordingly, BMCF is not responsible for the security of any information transmitted to or from the App.",
      ],
    },
    {
      subtitle: "Age Requirements/Notice to Parents",
      text: [
        "The App is intended solely for users who are 13 years of age or older, and any registration by, use of or access to the App by anyone under 13 is unauthorized without parental/guardian consent. If you are under 13 you should review these TOU with your parent or guardian to make sure that your parent or guardian understands them, agrees to be bound by them and you can only use the App with their permission and under their supervision. If you are a parent or guardian of a child who is under the age of 13 years of age and you give your child permission to use the App, you hereby agree to the terms set forth in these Terms of Use on behalf of both yourself and your child.",
      ],
    },
    {
      subtitle: "Community Guidelines",
      subtitleAlt: "Rights to Monitor",
      text: [
        "We want the App to be a place where people feel welcome, safe and empowered to express themselves and share their thoughts, and so we have created these community guidelines. Please note that BMCF will have the right to investigate and prosecute violations of any of the below standards to the fullest extent of the law. You acknowledge that BMCF has no obligation to monitor your access to or use of the App, but has the right to do so for the purpose of operating the App, and to ensure your compliance with these Terms of Use and community standards, or to comply with applicable law or the order or requirement of a court, administrative agency or other governmental body. BMCF reserves the right, at any time and without prior notice, to suspend or terminate your Account, or restrict, disable or permanently bar your use and access to the App (or any portion thereof) if we believe, in our sole discretion, that you have engaged, or may engage, in any of the below prohibited activities.",
      ],
    },
    {
      subtitle: "Guidelines",
      subtitleAlt: "You agree to abide by the following guidelines:",
      list: [
        "You represent that you are a cancer patient, survivor or caregiver.",
        "You agree to respect differences among participants in race, religion, gender and sexual orientation, among others. You acknowledge that BMCF respects all political and religious beliefs and agree to limit your discussion of politics and religion to their role in your physical and emotional health.",
        "You agree not to communicate any personally identifiable information about any person, without his/her/their advance written consent.",
        "You agree not to defame, abuse, harass, stalk, threaten or otherwise violate the legal rights of others, or participate in deliberate, repeated, hostile behavior. You also agree not to post messages that contain material that is inappropriate, false, misleading, unlawful, hateful, profane, disruptive, defamatory, false, abusive, libelous, hateful, obscene, racist, sexually explicit, ethnically or culturally offensive, indecent, obscene, pornographic, hostile, or indecent.",
        "You agree not to impersonate any person or entity, or falsely state or otherwise misrepresent your affiliation with a person or entity and not to use more than one username at a time.",
        "You acknowledge that all members are permitted only one set of Credentials, and that operating multiple Accounts, even with unique email addresses, is not permitted. You acknowledge that the use of false registration information or creating multiple Accounts on the App may result in permanent suspension of all associated registrations without notice.",
        "You agree not to violate the intellectual property rights of others, and you agree not to post any content that infringes any patent, trademark, trade secret, copyright or other proprietary rights of any party.",
        "You agree not to use the App for commercial purposes, marketing, self-promotion, or to advertise or promote any goods or services or solicit anyone to buy or sell goods or services.",
        "You agree not to violate any applicable local, state, national or international law in your use of this App.",
      ],
    },
    {
      subtitleAlt: "Reporting Abuse",
      text: [
        "If you believe any of the Content or activities/actions of a user on the App violates these TOU/Guidelines, please click “Block & report” next to that user’s name to report the violation",
      ],
    },
    {
      subtitle: "Health Care Disclaimer",
      text: [
        "Nothing in the content, information or treatment suggestions that might be offered by App users or otherwise appearing on the App (the “Content”) should be considered, or used as a substitute for, medical advice, diagnosis or treatment. Any content that may be shared by a user of the App is their own, and is not endorsed by BMCF. You hereby acknowledge, understand and agree that this App and its content do not constitute the practice of any medical, nursing or other professional health care advice, diagnosis or treatment, and that none of the Content has been reviewed by medical professionals. You should always talk to your health care provider for specific guidelines and instructions, including those related to diagnosis and treatment of medical conditions.",
      ],
    },
    {
      subtitle: "Disclaimers",
      text: [
        "While BMCF endeavors to provide a reliable and functional App, the App and all Content are provided on an “as-is” and “as available” basis and may include errors, omissions, or other inaccuracies. You assume the sole risk of making use and/or relying on the App and any Content. BMCF expressly disclaims all warranties and conditions with respect to the App and all elements thereof, whether implied, express, or statutory, including the implied warranties of merchantability, fitness for a particular purpose, title, non-infringement of third-party rights, satisfactory quality, quiet enjoyment and accuracy, or any other implied warranty under the uniform computer information transactions act as enacted by any state. BMCF also makes no representation or warranty that the App will operate error free or in an uninterrupted fashion or that any files or information that you download from the App will be free of viruses or contamination or destructive features.",
      ],
    },
    {
      subtitle: "Limitation of Liability",
      text: [
        "Under no circumstances shall BMCF (and its successors, parents, subsidiaries, affiliates, officers, directors, agents, developers, networks, and distributors) be liable for (i) any direct, indirect, punitive, incidental, special, exemplary, consequential damages or any damages whatsoever including, without limitation, damages for loss of use, data, business or profits that result from the use of, or the inability to use, the App, or (ii) any action taken in connection with an investigation by BMCF or law enforcement authorities regarding your or any other party’s use of the App, or (iii) any errors or omissions in the service’s operation, or any damage from any security breach or from any virus, bugs, tampering, fraud, error, omission, interruption, defect, delay in operation or transmission, computer line or network failure or any other technical or other malfunction, including, without limitation, loss of goodwill, whether in an action of contract, negligence, strict liability, tort or any other action. Applicable law may not allow the limitation or exclusion of liability or exemplary, incidental or consequential damages, so the above limitation or exclusion may not apply to you. By using this App, you expressly agree to the allocation of risk set forth herein; if you do not agree to this allocation of risk, you must not use the App.",
      ],
    },
    {
      subtitle: "Term and Termination",
      text: [
        "These TOU and your right to use the BMCF App will take effect at the moment you install or download the BMCF App or any of its features, and is effective until terminated as set forth below. In addition, BMCF reserves all of its legal rights to pursue any and all legal remedies if we believe you are using the App for fraudulent or unlawful activity or you are taking any actions or omissions that violate any term or condition of these TOU, or in order to protect its name and goodwill, its business, and/or other users. Termination will be effective without notice. you may also terminate these TOU at any time by ceasing to use the App and all of its related features, including any Content BMCF created by the App, but all applicable provisions of these TOU will survive termination, as identified below. Upon termination, you agree to delete or otherwise remove the App from your mobile device. In addition to the miscellaneous section below, the provisions concerning BMCF’s proprietary rights, feedback, indemnity, disclaimers of warranty, limitation of liability, and governing law will survive the termination of these TOU for any reason.",
      ],
    },
    {
      subtitle: "Intellectual property rights",
      subtitleAlt: "Trademarks and Service Marks",
      text: [
        "Certain trademarks are the service marks and trademarks of BMCF or one of its affiliates. All page headers, custom graphics, and button icons are service marks, trademarks, logos, and/or trade dress of BMCF or one of its affiliates. All other trademarks, service marks, trade dress, product names, company names or logos, whether registered or not, on the App are the property of their respective owners. In addition to complying with all applicable laws, you agree that you will not use any such trademarks, service marks, trade dress, or other logos from this App without the prior written authorization of BMCF or their respective owners.",
      ],
    },
    {
      subtitleAlt: "Copyright",
      text: [
        "Except as otherwise expressly stated, all content appearing on this App is the copyrighted work of either BMCF or its third party content suppliers or authorized users, and is protected by U.S. and international copyright laws. The compilation (meaning the collection, arrangement and assembly) of all content is also the exclusive property of BMCF, and is protected by U.S., and international copyright laws. Except as otherwise expressly stated herein or as expressly permitted, you may not alter, modify, copy, distribute (for compensation or otherwise), transmit, display, perform, reproduce, reuse, post, publish, license, frame, download, store for subsequent use, create derivative works from, transfer, or sell any information or content obtained from this App, in whole or in part, including any text, images, audio, and video in any manner, without the prior written authorization of BMCF, or any applicable third-party suppliers or authorized users. The use of content, including images, by you, or anyone else authorized by you, is prohibited unless specifically permitted by BMCF. Any unauthorized use of text or images may violate copyright laws, trademark laws, the laws of privacy and publicity, and applicable regulations and statutes. BMCF does not warrant nor represent that your use of any content or materials displayed on this Website will not infringe rights of third parties.",
      ],
    },
    {
      subtitle: "BMCF License Grant",
      text: [
        "The BMCF App is provided by BMCF, and these TOU provide to you a personal, revocable, limited, non-exclusive, royalty-free, non-transferable license to download and install a copy of the App on any mobile device or tablet that you own or control and to run such copy of the App solely for your own personal use. Your use the App and any services or information made available through the App is conditioned on your continued compliance with the terms and conditions of these TOU. Accordingly, you expressly acknowledge and agree that BMCF transfers no ownership or intellectual property interest or title in and to the BMCF App to you or anyone else. All text, graphics, user interfaces, visual interfaces, photographs, compositions, sounds, artwork, computer code (including html code), programs, software, products, information, and documentation, as well as the design, structure, selection, coordination, expression, “look and feel,” and arrangement of any content contained on or available through the App, unless otherwise indicated, are owned, controlled, and licensed by BMCF and its successors and assigns and are protected by law including, but not limited to, United States copyright, trade secret, patent, and trademark law, as well as other state, national, and international laws and regulations. Except as expressly provided herein, BMCF does not grant any express or implied right to you or any other person under any intellectual or proprietary rights. Accordingly, your unauthorized use of the BMCF App may violate intellectual property or other proprietary rights laws as well as other laws, regulations, and statutes.",
      ],
    },
    {
      subtitle: "Reservation of Rights",
      text: [
        "BMCF reserves the right in its sole discretion and at any time to modify, interrupt, limit, suspend or discontinue, temporarily or permanently, the App, in whole or in part, including, but not limited to, as we deem necessary for purposes of maintenance, upgrades and the like, or to maintain the App or to comply with applicable law. BMCF shall not be liable to you or to any third party for any such modifications, interruptions, suspensions or discontinuances of the App.",
      ],
    },
    {
      subtitle: "Indemnity",
      text: [
        "You agree to defend, indemnify, and hold harmless BMCF and affiliates and all of their respective employees, funders, parents, subsidiaries, joint ventures, affiliates, agents, developers, directors, and officers from and against any and all claims, proceedings, damages, injuries, liabilities, losses, costs, and expenses (including reasonable attorneys’ fees and litigation expenses) relating to or arising from any breach or alleged breach by you of these TOU.",
      ],
    },
    {
      subtitle: "Governing Law",
      text: [
        "These TOU has been made in and will be construed and enforced solely in accordance with the laws of the United States of America and the State of New York, U.S.A. as applied to agreements entered into and completely performed in the State of New York. You and BMCF each agree to submit to exclusive subject matter jurisdiction, personal jurisdiction, and venue to the federal and state courts located in New York County, New York.",
      ],
    },
    {
      subtitle: "Arbitration",
      text: [
        "Any disputes or claims under these TOU or its breach shall be submitted to and resolved exclusively by arbitration conducted in accordance with American Arbitration Association rules. One arbitrator appointed under such rules shall conduct arbitration. Arbitration shall be in New York County, New York, and the laws of New York shall be applied. Any decision in arbitration shall be final and binding upon the parties. Judgment may be entered thereon in any court of competent jurisdiction. Notwithstanding the above, BMCF may sue in any court for infringement of its proprietary or intellectual property rights. All claims you bring against BMCF must be resolved in accordance with this section. All claims filed or brought contrary to this section shall be considered improperly filed. Any claim or cause of action arising out of or related to use of the App and/or any of the services, or the Ads, Rewards or the TOU, must be filed within one (1) year after such claim or cause of action arose regardless of any status or law to the contrary. In the event any such claim or cause of action is not filed within such one (1) year period, such claim or cause of action shall be barred. Any failure to act by BMCF with respect to a breach by you or others does not waive BMCF’s right to act with respect to subsequent or similar breaches.",
      ],
    },
    {
      title: "No Class Action",
      text: [
        "You and BMCF agree that any proceedings to resolve or litigate any dispute will be conducted solely on an individual basis, and that neither you nor BMCF will seek to have any dispute heard as a class action, a representative action, a collective action, a private attorney-general action, or in any proceeding in which you or BMCF acts or proposes to act in a representative capacity. You and BMCF further agree that no proceeding will be joined, consolidated, or combined with another proceeding without the prior written consent of you, BMCF, and all parties to any such proceeding.",
      ],
    },
    {
      subtitle: "Miscellaneous",
      text: [
        "These TOU constitute the entire agreement between you and BMCF and governs your use of the App, superseding any prior agreements between you and BMCF. you will not assign the TOU or assign any rights or delegate any obligations hereunder, in whole or in part, whether voluntarily or by operation of law, without the prior written consent of BMCF. Any purported assignment or delegation by you without the appropriate prior written consent of BMCF will be null and void. We may assign these TOU or any rights hereunder without your consent. Failure by BMCF to insist on strict performance of any of the terms and conditions of these TOU will not operate as a waiver by BMCF of that or any subsequent default or failure of performance. The App is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject BMCF to any registration requirement within such jurisdiction or country. We reserve the right to limit the availability of the App or any portion of the App, to any person, geographic area, or jurisdiction, at any time and in our sole discretion, and to limit the service or other features that the App provides. If any provision (or part thereof) contained in these TOU is determined to be void, invalid, or otherwise unenforceable by a court of competent jurisdiction or on account of a conflict with an applicable government regulation, such determination shall not affect the remaining provisions (or parts thereof) contained herein and the illegal, invalid, or unenforceable clause shall be modified in compliance with applicable law in a manner that most closely matches the intent of the original language. No joint venture, partnership, employment, or agency relationship exists between you and BMCF as result of these TOU or your utilization of the BMCF App. Headings herein are for convenience only.",
      ],
    },
    {
      subtitle: "Changes to the Terms of Use",
      text: [
        "BMCF reserve the right to change, alter, replace or otherwise modify these Terms of Use at any time. The date of last modification is stated at the end of these Terms of Use. It is your responsibility to check this page from time to time for updates.",
      ],
    },
    {
      subtitleAlt: "Terms of Service: last updated January 26, 2022.",
    },
  ],
};

export const LEGAL_DOCUMENTS = {
  privacy: PRIVACY_POLICY,
  "child-safety": CHILD_SAFETY,
  terms: TERMS_OF_USE,
} as const;
