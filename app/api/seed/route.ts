import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';
import VendorModel from '@/lib/models/Vendor';
import { CATEGORIES, VENDORS } from '@/data/seedData';

export async function POST() {
  try {
    await connectDB();

    await CategoryModel.deleteMany({});
    await VendorModel.deleteMany({});

    await CategoryModel.insertMany(CATEGORIES);
    await VendorModel.insertMany(VENDORS);

    return NextResponse.json({
      success: true,
      message: `Seeded ${CATEGORIES.length} categories and ${VENDORS.length} vendors`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to seed the database' });
}
