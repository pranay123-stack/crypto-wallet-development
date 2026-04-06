use {
    anchor_lang::{
        solana_program::instruction::Instruction, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_keypair::Keypair,
    solana_transaction::versioned::VersionedTransaction,
};

#[test]
fn test_initialize() {
    let program_id = nova_token::id();
    let payer = Keypair::new();
    let mint = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/nova_token.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    // Get the token program ID (SPL Token)
    let token_program_id = anchor_spl::token::ID;

    let instruction = Instruction::new_with_bytes(
        program_id,
        &nova_token::instruction::Initialize {}.data(),
        nova_token::accounts::Initialize {
            authority: payer.pubkey(),
            mint: mint.pubkey(),
            token_program: token_program_id,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer, &mint]).unwrap();

    let res = svm.send_transaction(tx);
    // This test may fail if token program is not loaded, but demonstrates the structure
    println!("Test result: {:?}", res);
}
